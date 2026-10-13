"""Private local API called only by Zhiheng's Next.js server."""

import secrets
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from dotenv import load_dotenv

from jobs import JobManager, ServiceBusy
from probe import PROJECT_ROOT, RUNTIME_ROOT, configure_runtime
from schemas import TaskInput


def service_token() -> str:
    path = RUNTIME_ROOT / "service-token.txt"
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        try:
            with path.open("x", encoding="utf-8") as token_file:
                token_file.write(secrets.token_hex(32))
        except FileExistsError:
            pass
    token = path.read_text(encoding="utf-8").strip()
    if len(token) != 64:
        raise RuntimeError("Local service token file is invalid.")
    return token


def create_app(token: str, runner) -> FastAPI:
    manager = JobManager(runner)

    @asynccontextmanager
    async def lifespan(app):
        yield
        await manager.close()

    app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)

    @app.middleware("http")
    async def authorize(request: Request, call_next):
        supplied = request.headers.get("X-Agent-Token", "")
        if not secrets.compare_digest(supplied.encode(), token.encode()):
            from fastapi.responses import JSONResponse
            return JSONResponse({"detail": "本地执行服务令牌无效。"}, status_code=403)
        if len(await request.body()) > 32000:
            from fastapi.responses import JSONResponse
            return JSONResponse({"detail": "任务请求过长。"}, status_code=413)
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.get("/health")
    async def health():
        return {"ok": True, "busy": manager.busy, "framework": "browser-use 0.13.11"}

    @app.post("/tasks")
    async def create_task(data: TaskInput):
        try:
            return manager.create(data).snapshot()
        except ServiceBusy:
            raise HTTPException(409, "已有浏览器任务进行中，请等待或取消后重试。") from None
        except ValueError:
            raise HTTPException(409, "请求编号已用于另一任务。") from None

    @app.get("/tasks/{task_id}")
    async def read_task(task_id: str):
        try:
            return manager.get(task_id).snapshot()
        except KeyError:
            raise HTTPException(404, "任务不存在或执行服务已重启，请重新发起。") from None

    @app.delete("/tasks/{task_id}")
    async def cancel_task(task_id: str):
        try:
            job = await manager.cancel(task_id)
            return job.snapshot() if job is not None else {"cancelled": True}
        except KeyError:
            raise HTTPException(404, "任务不存在。") from None
        except ValueError:
            raise HTTPException(400, "任务编号无效。") from None
        except TimeoutError:
            raise HTTPException(503, "任务仍在停止，请稍后查看状态。") from None

    return app


def create_local_app() -> FastAPI:
    configure_runtime()
    load_dotenv(PROJECT_ROOT / ".env.local", override=False)
    from runner import execute_search
    return create_app(service_token(), execute_search)
