import assert from "node:assert/strict";
import test from "node:test";
import { getExtractionContext, selectChatInsights } from "../src/lib/profile/context.ts";
import type { Conversation } from "../src/lib/chat/store.ts";
import type { ProfileInsight } from "../src/types/cognitive.ts";

test("extraction reports omitted messages when its character budget is reached", () => {
  const conversation: Conversation = {
    id: "c1", title: "虚构测试", createdAt: "now", updatedAt: "now",
    messages: Array.from({ length: 3 }, (_, index) => ({
      id: `m${index}`, role: "user", content: "学".repeat(9000), createdAt: "now",
    })),
  };
  const scope = getExtractionContext(conversation);
  assert.deepEqual(scope.messages.map((message) => message.id), ["m1", "m2"]);
  assert.equal(scope.totalUserMessages, 3);
  assert.equal(scope.omittedUserMessages, 1);
  assert.equal(getExtractionContext(null).messages.length, 0);
});

test("chat selection excludes unreviewed records and falls back to later additions without a keyword match", () => {
  const insights: ProfileInsight[] = Array.from({ length: 25 }, (_, index) => ({
    id: `i${index}`, dimension: "behavioral_patterns", statement: "study first",
    origin: "ai_inference", status: index === 24 ? "candidate" : index === 23 ? "rejected" : "confirmed",
    evidence: [{ conversationId: "c1", messageId: "m1", excerpt: "study first" }],
  }));
  const selected = selectChatInsights(insights, "weather");
  assert.equal(selected.length, 20);
  assert.equal(selected[0].id, "i22");
  assert.equal(selected.at(-1)?.id, "i3");
});

test("English keyword matches preserve an older relevant insight", () => {
  const insights: ProfileInsight[] = ["Learning Python", "Playing football"].map((statement, index) => ({
    id: `i${index}`, dimension: "knowledge_structure", statement, origin: "user_statement", status: "confirmed",
    evidence: [{ conversationId: "c1", messageId: "m1", excerpt: statement }],
  }));
  assert.equal(selectChatInsights(insights, "How to learn PYTHON?")[0].id, "i0");
});
