import assert from "node:assert/strict";
import test from "node:test";
import { parseSemanticInput, scoreSemanticInput } from "../src/lib/retrieval/scoring.ts";

test("semantic service accepts only bounded minimal text records, not arbitrary request fields", () => {
  const input = { query: "怎么开始", insights: [{ id: "p1", text: "先动手尝试" }], goals: [] };
  assert.deepEqual(parseSemanticInput(input), input);
  for (const bad of [
    { ...input, query: " " }, { ...input, query: "长".repeat(1201) },
    { ...input, insights: Array.from({ length: 101 }, (_, index) => ({ id: `p${index}`, text: "合成资料" })) },
    { ...input, insights: [...input.insights, ...input.insights] },
    { ...input, insights: [{ id: "p", text: "资料", evidence: ["不接收原始证据"] }] },
    { ...input, messages: [{ content: "不接收全部聊天" }] },
  ]) assert.throws(() => parseSemanticInput(bad));
});

test("semantic service computes cosine from supplied embeddings and keeps profile/goal identities separate", async () => {
  const seen: string[][] = [];
  const input = { query: "合成问题", insights: [{ id: "same-id", text: "合成画像" }], goals: [{ id: "same-id", text: "合成目标" }] };
  const scores = await scoreSemanticInput(input, async (texts) => {
    seen.push(texts);
    return [[1, 0], [1, 0], [0, 1]];
  });
  assert.deepEqual(seen, [["合成问题", "合成画像", "合成目标"]]);
  assert.equal(scores.insights["same-id"], 1);
  assert.equal(scores.goals["same-id"], 0);
});

test("an embedding failure propagates rather than fabricating semantic matches", async () => {
  await assert.rejects(scoreSemanticInput({ query: "合成问题", insights: [{ id: "p", text: "合成画像" }], goals: [] }, async () => { throw new Error("模型缺失"); }), /模型缺失/);
});
