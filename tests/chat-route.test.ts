import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../src/app/api/chat/route.ts";

test("chat endpoint rejects an invalid request before contacting the model", async () => {
  const response = await POST(new Request("http://127.0.0.1:3000/api/chat", {
    method: "POST",
    body: JSON.stringify({ messages: [] }),
    headers: { "Content-Type": "application/json" },
  }));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "VALIDATION_ERROR");
});

test("chat endpoint does not expose a configured model to another origin", async () => {
  const response = await POST(new Request("http://127.0.0.1:3000/api/chat", {
    method: "POST",
    body: JSON.stringify({ messages: [{ role: "user", content: "你好" }] }),
    headers: { "Content-Type": "application/json", Origin: "https://other.example" },
  }));
  assert.equal(response.status, 403);
});

test("chat endpoint accepts the browser origin when Next internally uses localhost", async () => {
  const response = await POST(new Request("http://localhost:3001/api/chat", {
    method: "POST",
    body: JSON.stringify({ messages: [] }),
    headers: {
      "Content-Type": "application/json",
      Host: "127.0.0.1:3001",
      Origin: "http://127.0.0.1:3001",
    },
  }));
  assert.equal(response.status, 400);
});
