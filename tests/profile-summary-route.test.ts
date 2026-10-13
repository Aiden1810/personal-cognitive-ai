import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "../src/app/api/profile/summary/route.ts";

test("memory summary route rejects foreign origins and empty source data before model calls", async () => {
  const foreign = new Request("http://localhost:3001/api/profile/summary", { method: "POST", headers: { origin: "https://foreign.example", host: "localhost:3001" }, body: '{}' });
  assert.equal((await POST(foreign)).status, 403);
  const empty = new Request("http://localhost:3001/api/profile/summary", { method: "POST", headers: { origin: "http://localhost:3001", host: "localhost:3001" }, body: '{"insights":[]}' });
  assert.equal((await POST(empty)).status, 400);
});

test("public production summary remains disabled", async () => {
  const old = process.env.NODE_ENV;
  try {
    Object.assign(process.env, { NODE_ENV: "production" });
    assert.equal((await POST(new Request("http://localhost:3001/api/profile/summary", { method: "POST", body: '{}' }))).status, 503);
  } finally { if (old === undefined) Reflect.deleteProperty(process.env, "NODE_ENV"); else Object.assign(process.env, { NODE_ENV: old }); }
});

test("memory summary route still rejects 21 records", async () => {
  const insights = Array.from({ length: 21 }, (_, index) => ({ id: `i${index}`, dimension: "planning", statement: "合成资料：先拆步骤", quotes: ["先拆步骤"] }));
  const response = await POST(new Request("http://localhost:3001/api/profile/summary", {
    method: "POST", headers: { host: "localhost:3001" }, body: JSON.stringify({ insights }),
  }));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "VALIDATION_ERROR");
});
