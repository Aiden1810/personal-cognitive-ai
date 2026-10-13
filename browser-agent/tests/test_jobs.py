import asyncio
import unittest
from uuid import uuid4

from jobs import JobManager, ServiceBusy
from schemas import TaskInput


def request(task="查找公开学习资料"):
    return TaskInput(requestId=str(uuid4()), task=task, plan={
        "objective": task, "queries": ["Python official tutorial"], "criteria": ["免费"],
    })


class TaskLifecycleTests(unittest.IsolatedAsyncioTestCase):
    async def test_terminal_task_expires_when_read_after_thirty_minutes(self):
        async def runner(data, emit):
            return [{"url":"https://docs.python.org/","title":"Python","excerpt":"Python","visitedAt":"2026-10-12T00:00:00Z"}]

        manager = JobManager(runner)
        job = manager.create(request())
        await asyncio.sleep(0)
        self.assertEqual(job.status, "completed")
        job.touched -= 1801
        with self.assertRaises(KeyError):
            manager.get(job.id)

    async def test_cancel_during_planning_prevents_a_late_create(self):
        calls = []

        async def runner(data, emit):
            calls.append(data.requestId)
            return []

        manager = JobManager(runner)
        data = request()
        self.assertIsNone(await manager.cancel(data.requestId))
        job = manager.create(data)
        await asyncio.sleep(0)
        self.assertEqual(job.status, "cancelled")
        self.assertEqual(calls, [])

    async def test_duplicate_request_does_not_launch_a_second_browser(self):
        gate = asyncio.Event()
        calls = []

        async def runner(data, emit):
            calls.append(data.requestId)
            await gate.wait()
            return [{"url": "https://docs.python.org/3/tutorial/", "title": "Tutorial", "excerpt": "Python", "visitedAt": "2026-10-12T00:00:00Z"}]

        manager = JobManager(runner)
        data = request()
        first = manager.create(data)
        self.assertEqual(manager.create(data).id, first.id)
        with self.assertRaises(ServiceBusy):
            manager.create(request("另一任务"))
        await asyncio.sleep(0)
        self.assertEqual(calls, [data.requestId])
        gate.set()
        await manager.close()

    async def test_cancel_waits_for_cleanup_before_accepting_another_task(self):
        started = asyncio.Event()
        cleaned = asyncio.Event()
        release = asyncio.Event()

        async def runner(data, emit):
            started.set()
            try:
                await asyncio.Event().wait()
            finally:
                await release.wait()
                cleaned.set()

        manager = JobManager(runner)
        job = manager.create(request())
        await started.wait()
        cancellation = asyncio.create_task(manager.cancel(job.id))
        await asyncio.sleep(0)
        with self.assertRaises(ServiceBusy):
            manager.create(request())
        self.assertFalse(cleaned.is_set())
        release.set()
        await cancellation
        self.assertTrue(cleaned.is_set())
        self.assertEqual(manager.get(job.id).status, "cancelled")
        self.assertFalse(manager.busy)

    async def test_failure_is_reported_without_exception_or_secret_details(self):
        async def runner(data, emit):
            raise RuntimeError("secret-key example provider request body")

        manager = JobManager(runner)
        job = manager.create(request())
        await asyncio.sleep(0)
        self.assertEqual(manager.get(job.id).status, "failed")
        self.assertNotIn("secret-key", manager.get(job.id).error)
        self.assertFalse(manager.busy)

    async def test_completed_resources_and_events_are_returned(self):
        async def runner(data, emit):
            emit("browse", "正在浏览", "https://docs.python.org/", "Python")
            return [{"url": "https://docs.python.org/", "title": "Python", "excerpt": "Python", "visitedAt": "2026-10-12T00:00:00Z"}]

        manager = JobManager(runner)
        job = manager.create(request())
        await asyncio.sleep(0)
        snapshot = manager.get(job.id)
        self.assertEqual(snapshot.status, "completed")
        self.assertEqual(len(snapshot.resources), 1)
        self.assertEqual(snapshot.events[0]["kind"], "browse")


if __name__ == "__main__":
    unittest.main()
