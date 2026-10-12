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

test("chat endpoint defaults to Flash when no model is configured", async () => {
  const previousKey = process.env.LLM_API_KEY;
  const previousModel = process.env.LLM_MODEL;
  const previousFetch = globalThis.fetch;
  let requestedModel: unknown;
  try {
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_MODEL = "";
    globalThis.fetch = (async (_input, init) => {
      requestedModel = JSON.parse(String(init?.body)).model;
      return Response.json({ choices: [{ message: { role: "assistant", content: "你好" } }] });
    }) as typeof fetch;
    const response = await POST(new Request("http://127.0.0.1:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({ messages: [{ role: "user", content: "你好" }] }),
      headers: { "Content-Type": "application/json" },
    }));
    assert.equal(response.status, 200);
    assert.equal(requestedModel, "deepseek-flash");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.LLM_API_KEY;
    else process.env.LLM_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.LLM_MODEL;
    else process.env.LLM_MODEL = previousModel;
  }
});
