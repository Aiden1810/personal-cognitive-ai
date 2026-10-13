import asyncio
import unittest
from uuid import uuid4

from jobs import JobManager, ServiceBusy
from runner import close_browser
from schemas import TaskInput


class CleanupRaceTests(unittest.IsolatedAsyncioTestCase):
    async def test_cancel_while_browser_is_closing_keeps_slot_until_close_finishes(self):
        closing = asyncio.Event()
        release = asyncio.Event()
        closed = asyncio.Event()

        class Browser:
            async def kill(self):
                closing.set()
                await release.wait()
                closed.set()

        async def runner(data, emit):
            await close_browser(Browser())
            return []

        manager = JobManager(runner)
        data = TaskInput(requestId=str(uuid4()), task="测试", plan={"objective":"测试","queries":["Python"],"criteria":["官方"]})
        job = manager.create(data)
        await closing.wait()
        cancellation = asyncio.create_task(manager.cancel(job.id))
        await asyncio.sleep(0)
        self.assertTrue(manager.busy)
        self.assertFalse(closed.is_set())
        release.set()
        await cancellation
        self.assertTrue(closed.is_set())
        self.assertEqual(job.status, "cancelled")
        self.assertFalse(manager.busy)

    async def test_failed_cleanup_blocks_new_browsers(self):
        class Browser:
            async def kill(self):
                raise RuntimeError("CDP close failed")

        async def runner(data, emit):
            await close_browser(Browser())

        manager = JobManager(runner)
        data = TaskInput(requestId=str(uuid4()), task="测试", plan={"objective":"测试","queries":["Python"],"criteria":["官方"]})
        job = manager.create(data)
        await asyncio.sleep(0.02)
        self.assertEqual(job.status, "failed")
        self.assertTrue(manager.busy)
        with self.assertRaises(ServiceBusy):
            manager.create(data.model_copy(update={"requestId":str(uuid4())}))
