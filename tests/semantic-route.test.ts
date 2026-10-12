import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../src/app/api/retrieval/semantic/route.ts";

test("semantic endpoint rejects other origins and invalid records before loading a model", async () => {
  const otherOrigin = await POST(new Request("http://127.0.0.1:3010/api/retrieval/semantic", { method: "POST", headers: { Origin: "https://other.example" }, body: "{}" }));
  assert.equal(otherOrigin.status, 403);
  const invalid = await POST(new Request("http://127.0.0.1:3010/api/retrieval/semantic", { method: "POST", body: JSON.stringify({ query: "问题", insights: [], goals: [], messages: ["不允许全部原文"] }) }));
  assert.equal(invalid.status, 400);
});

test("production semantic endpoint is disabled before any model loading", async () => {
  const environment: Record<string, string | undefined> = process.env;
  const previous = environment.NODE_ENV;
  try {
    environment.NODE_ENV = "production";
    const response = await POST(new Request("http://127.0.0.1:3010/api/retrieval/semantic", { method: "POST", body: "{}" }));
    assert.equal(response.status, 503);
  } finally {
    if (previous === undefined) delete environment.NODE_ENV;
    else environment.NODE_ENV = previous;
  }
});
