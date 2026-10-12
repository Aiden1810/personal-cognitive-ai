import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../src/app/api/profile/reflect/route.ts";

test("综合观察接口拒绝缺少原话的资料", async () => {
  const response = await POST(new Request("http://127.0.0.1:3000/api/profile/reflect", {
    method: "POST", body: JSON.stringify({ insights: [{ id: "i1", dimension: "personality", statement: "描述", quotes: [] }] }),
    headers: { "Content-Type": "application/json" },
  }));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "VALIDATION_ERROR");
});

test("综合观察接口拒绝其他来源", async () => {
  const response = await POST(new Request("http://127.0.0.1:3000/api/profile/reflect", {
    method: "POST", body: JSON.stringify({ insights: [] }), headers: { Origin: "https://other.example" },
  }));
  assert.equal(response.status, 403);
});
