import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../src/app/api/profile/extract/route.ts";

test("profile extraction endpoint rejects conversations without user evidence", async () => {
  const response = await POST(new Request("http://127.0.0.1:3000/api/profile/extract", {
    method: "POST",
    body: JSON.stringify({ conversationId: "c1", messages: [] }),
    headers: { "Content-Type": "application/json" },
  }));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "VALIDATION_ERROR");
});

test("profile extraction endpoint rejects an external origin", async () => {
  const response = await POST(new Request("http://127.0.0.1:3000/api/profile/extract", {
    method: "POST",
    body: JSON.stringify({ conversationId: "c1", messages: [] }),
    headers: { Origin: "https://other.example" },
  }));
  assert.equal(response.status, 403);
});
