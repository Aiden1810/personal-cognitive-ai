import assert from "node:assert/strict";
import test from "node:test";
import { selectChatContext } from "../src/lib/chat/context.ts";
import { usableProfileInsights } from "../src/lib/profile/usable.ts";
import { retrievalCases } from "./fixtures/retrieval-cases.ts";

for (const example of retrievalCases) {
  test(`合成检索验收：${example.name}`, () => {
    const selected = selectChatContext(example.history, usableProfileInsights(example.insights, example.conversations), example.goals);
    assert.deepEqual(selected.insights.map((item) => item.id).sort(), [...example.expectedInsightIds].sort());
    assert.deepEqual(selected.goals.map((item) => item.id).sort(), [...example.expectedGoalIds].sort());
  });
}
