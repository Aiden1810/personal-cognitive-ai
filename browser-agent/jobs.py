"""One browser at a time, with cancellation and a small in-memory task history."""

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timezone
from time import monotonic

from schemas import Resource, TaskInput


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


class ServiceBusy(Exception):
    pass


class RunFailure(Exception):
    """A safe, user-facing failure message supplied by the controlled runner."""


class CleanupFailure(RunFailure):
    pass


@dataclass
class Job:
    data: TaskInput
    status: str = "queued"
    events: list[dict] = field(default_factory=list)
    resources: list[dict] = field(default_factory=list)
    error: str | None = None
    createdAt: str = field(default_factory=now)
    finishedAt: str | None = None
    touched: float = field(default_factory=monotonic)

    @property
    def id(self) -> str:
        return self.data.requestId

    def snapshot(self) -> dict:
        return {"id": self.id, "task": self.data.task, "status": self.status, "plan": self.data.plan.model_dump(),
                "events": list(self.events), "resources": list(self.resources),
                "createdAt": self.createdAt, "finishedAt": self.finishedAt, "error": self.error}


class JobManager:
    def __init__(self, runner):
        self.runner = runner
        self.jobs: dict[str, Job] = {}
        self.active: asyncio.Task | None = None
        self.active_id: str | None = None
        self.blocked = False
        self.cancelled_before_create: dict[str, float] = {}

    @property
    def busy(self) -> bool:
        return self.blocked or (self.active is not None and not self.active.done())

    def create(self, data: TaskInput) -> Job:
        existing = self.jobs.get(data.requestId)
        if existing:
            if existing.data.task != data.task:
                raise ValueError("requestId belongs to a different task")
            return existing
        self.cancelled_before_create = {key: expiry for key, expiry in self.cancelled_before_create.items() if expiry > monotonic()}
        if data.requestId in self.cancelled_before_create:
            job = Job(data, status="cancelled", finishedAt=now())
            self.jobs[job.id] = job
            return job
        if self.busy:
            raise ServiceBusy()
        # Retain at most 20 terminal tasks, for at most 30 minutes. No personal archive.
        expired = [key for key, job in self.jobs.items() if monotonic() - job.touched > 1800]
        for key in expired:
            del self.jobs[key]
        while len(self.jobs) >= 20:
            del self.jobs[next(iter(self.jobs))]
        job = Job(data)
        self.jobs[job.id] = job
        self.active_id = job.id
        self.active = asyncio.create_task(self._execute(job))
        return job

    def get(self, task_id: str) -> Job:
        job = self.jobs[task_id]
        if job.finishedAt is not None and monotonic() - job.touched > 1800:
            del self.jobs[task_id]
            raise KeyError(task_id)
        return job

    async def _execute(self, job: Job) -> None:
        job.status = "running"

        def emit(kind: str, message: str, url: str | None = None, title: str | None = None):
            if len(job.events) < 100:
                job.events.append({"sequence": len(job.events) + 1, "kind": kind,
                                   "message": message[:300], "url": url, "title": title,
                                   "at": now()})
        try:
            resources = await self.runner(job.data, emit)
            if not resources:
                raise RunFailure("没有获得能与实际网页核对的资料，请调整任务后重试。")
            job.resources = [Resource.model_validate(item).model_dump(mode="json") for item in resources[:5]]
            job.status = "completed"
        except asyncio.CancelledError:
            job.status = "cancelled"
        except CleanupFailure:
            job.status = "failed"
            job.error = "浏览器关闭未确认，请重启执行服务后再试。"
            self.blocked = True
        except RunFailure as error:
            job.status = "failed"
            job.error = str(error)
        except Exception:
            job.status = "failed"
            job.error = "浏览器任务失败，请检查执行服务和模型配置后重试。"
        finally:
            job.finishedAt = now()
            job.touched = monotonic()
            self.active_id = None

    async def cancel(self, task_id: str) -> Job | None:
        if task_id not in self.jobs:
            # Cancellation can arrive while Next.js is still generating the plan.
            from uuid import UUID
            task_id = str(UUID(task_id))
            self.cancelled_before_create[task_id] = monotonic() + 300
            while len(self.cancelled_before_create) > 100:
                del self.cancelled_before_create[next(iter(self.cancelled_before_create))]
            return None
        job = self.get(task_id)
        if task_id == self.active_id and self.active is not None:
            active_task = self.active
            if job.status != "cancelling":
                job.status = "cancelling"
                active_task.cancel()
            # Shield the runner's cleanup against a disconnected DELETE request.
            try:
                await asyncio.wait_for(asyncio.shield(active_task), timeout=25)
            except asyncio.CancelledError:
                # A queued task may be cancelled before its coroutine starts.
                if active_task.done():
                    job.status = "cancelled"
                    job.finishedAt = now()
                    self.active_id = None
                else:
                    raise
        return job

    async def close(self) -> None:
        if self.active_id:
            await self.cancel(self.active_id)
