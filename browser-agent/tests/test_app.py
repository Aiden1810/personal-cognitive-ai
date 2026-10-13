import unittest
from uuid import uuid4

from fastapi.testclient import TestClient
from app import create_app


async def empty_runner(data, emit):
    return []


class ServiceApiTests(unittest.TestCase):
    def test_requires_a_server_token_and_does_not_enable_cors(self):
        with TestClient(create_app("synthetic-token", empty_runner)) as client:
            response = client.get("/health")
            self.assertEqual(response.status_code, 403)
            self.assertNotIn("access-control-allow-origin", response.headers)
            self.assertEqual(client.get("/health", headers={"X-Agent-Token": "synthetic-token"}).status_code, 200)

    def test_validates_tasks_and_reports_unknown_ids(self):
        with TestClient(create_app("synthetic-token", empty_runner)) as client:
            client.headers["X-Agent-Token"] = "synthetic-token"
            self.assertEqual(client.post("/tasks", json={"task": ""}).status_code, 422)
            self.assertEqual(client.get("/tasks/" + str(uuid4())).status_code, 404)


if __name__ == "__main__":
    unittest.main()
