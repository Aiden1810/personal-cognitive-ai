import assert from "node:assert/strict";
import test from "node:test";
import {
  extractProfileCandidates,
  parseExtractionRequest,
} from "../src/lib/profile/extract.ts";

const input = {
  conversationId: "c1",
  messages: [
    { id: "m1", role: "user", content: "比赛还有五天，我又想加一个新功能。" },
    { id: "m2", role: "assistant", content: "你可以先完成核心功能。" },
  ],
};

function modelResponse(candidates: unknown) {
  return Response.json({
    choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ candidates }) } }],
  });
}

test("extraction returns a pending insight with a verbatim user quote", async () => {
  const result = await extractProfileCandidates(parseExtractionRequest(input), {
    apiKey: "test-key",
    model: "deepseek-flash",
    fetcher: async () => modelResponse([{
      dimension: "behavioral_patterns",
      statement: "临近比赛截止时仍想增加功能",
      evidence: [{ messageId: "m1", quote: "我又想加一个新功能" }],
    }]),
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].status, "candidate");
  assert.equal(result[0].origin, "ai_inference");
  assert.deepEqual(result[0].evidence, [{
    conversationId: "c1", messageId: "m1", excerpt: "我又想加一个新功能",
  }]);
});

test("invented quotations and assistant messages cannot become evidence", async () => {
  const result = await extractProfileCandidates(parseExtractionRequest(input), {
    apiKey: "test-key",
    model: "deepseek-flash",
    fetcher: async () => modelResponse([
      {
        dimension: "behavioral_patterns",
        statement: "总在截止前拖延",
        evidence: [{ messageId: "m1", quote: "我总在拖延" }],
      },
      {
        dimension: "cognitive_architecture",
        statement: "优先完成核心功能",
        evidence: [{ messageId: "m2", quote: "先完成核心功能" }],
      },
    ]),
  });
  assert.deepEqual(result, []);
});

test("extraction requires at least one user message", () => {
  assert.throws(() => parseExtractionRequest({
    conversationId: "c1",
    messages: [{ id: "m2", role: "assistant", content: "你好" }],
  }), /用户消息/);
});

test("malformed model JSON is reported rather than stored", async () => {
  await assert.rejects(
    extractProfileCandidates(parseExtractionRequest(input), {
      apiKey: "test-key",
      model: "deepseek-flash",
      fetcher: async () => Response.json({
        choices: [{ finish_reason: "stop", message: { content: "not json" } }],
      }),
    }),
    /结构化结果无效/,
  );
});

test("no evidence is a valid empty extraction", async () => {
  const result = await extractProfileCandidates(parseExtractionRequest(input), {
    apiKey: "test-key",
    model: "deepseek-flash",
    fetcher: async () => modelResponse([]),
  });
  assert.deepEqual(result, []);
});
