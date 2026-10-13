import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../src/app/api/agent/tasks/route.ts";

test("agent denies foreign origins before contacting model or browser service", async () => {
  const response = await POST(new Request("http://127.0.0.1:3001/api/agent/tasks", { method: "POST", headers: { Origin: "https://other.example" }, body: "{}" }));
  assert.equal(response.status, 403);
});

test("agent validates the request before contacting execution service", async () => {
  const response = await POST(new Request("http://127.0.0.1:3001/api/agent/tasks", { method: "POST", body: "{}" }));
  assert.equal(response.status, 400);
});

test("agent remains disabled in production", async () => {
  const env = process.env as Record<string, string | undefined>;
  const previous = env.NODE_ENV;
  try {
    env.NODE_ENV = "production";
    const response = await POST(new Request("http://127.0.0.1:3001/api/agent/tasks", { method: "POST", body: "{}" }));
    assert.equal(response.status, 503);
  } finally { if (previous === undefined) delete env.NODE_ENV; else env.NODE_ENV = previous; }
});
