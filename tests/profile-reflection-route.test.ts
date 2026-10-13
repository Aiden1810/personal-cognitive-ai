import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "../src/app/api/profile/reflect/route.ts";

function request(body: string) {
  return new Request("http://localhost:3001/api/profile/reflect", {
    method: "POST", headers: { origin: "http://localhost:3001", host: "localhost:3001" }, body,
  });
}

test("reflection route sends 100 records beyond the former character limit and rejects excessive input", async () => {
  const sources = Array.from({ length: 100 }, (_, index) => ({
    id: `i${index}`, dimension: "planning", statement: "合成资料：先拆解项目步骤", quotes: ["合成原话。".repeat(80)],
  }));
  const body = JSON.stringify({ insights: sources });
  assert.ok(body.length > 30000);
  const previousKey = process.env.LLM_API_KEY;
  const previousFetch = globalThis.fetch;
  let calls = 0;
  try {
    process.env.LLM_API_KEY = "synthetic-key";
    globalThis.fetch = async (_input, init) => {
      calls++;
      const sent = JSON.parse(String(init?.body));
      assert.deepEqual(JSON.parse(sent.messages[1].content).insights, sources);
      return Response.json({ choices: [{ message: { content: JSON.stringify({ strengths: [], growthAreas: [], tensions: [] }) } }] });
    };
    assert.equal((await POST(request(body))).status, 200);
    assert.equal((await POST(request(JSON.stringify({ insights: [...sources, { ...sources[0], id: "i100" }] })))).status, 400);
    assert.equal((await POST(request(JSON.stringify({ insights: [{ ...sources[0], quotes: ["x".repeat(501)] }] })))).status, 400);
    assert.equal((await POST(request(" ".repeat(150001)))).status, 400);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.LLM_API_KEY;
    else process.env.LLM_API_KEY = previousKey;
  }
});
