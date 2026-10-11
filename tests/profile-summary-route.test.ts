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
