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

test("chat selection returns no profile when the question has no relevant match", () => {
  const insights: ProfileInsight[] = Array.from({ length: 25 }, (_, index) => ({
    id: `i${index}`, dimension: "behavioral_patterns", statement: "study first",
    origin: "ai_inference", status: index === 24 ? "candidate" : index === 23 ? "rejected" : "confirmed",
    evidence: [{ conversationId: "c1", messageId: "m1", excerpt: "study first" }],
  }));
  const selected = selectChatInsights(insights, "weather");
  assert.deepEqual(selected, []);
});

test("study and competition questions exclude diet and travel even without identical wording", () => {
  const insights: ProfileInsight[] = [
    "截止日期临近时，我常想追加功能",
    "我偏好清淡饮食",
    "我喜欢海边旅行",
  ].map((statement, index) => ({
    id: `i${index}`, dimension: "behavioral_patterns", statement,
    origin: "user_statement", status: "confirmed",
    evidence: [{ conversationId: "c1", messageId: `m${index}`, excerpt: statement }],
  }));
  assert.deepEqual(selectChatInsights(insights, "我今晚应该先复习还是继续做比赛项目？").map((item) => item.id), ["i0"]);
});

test("generic wording does not turn unrelated preferences into a match", () => {
  const insight: ProfileInsight = {
    id: "i1", dimension: "personality", statement: "用户希望自己更喜欢海边旅行",
    origin: "user_statement", status: "confirmed",
    evidence: [{ conversationId: "c1", messageId: "m1", excerpt: "我喜欢海边旅行" }],
  };
  assert.deepEqual(selectChatInsights([insight], "我希望你帮我复习"), []);
});

test("English keyword matches preserve an older relevant insight", () => {
  const insights: ProfileInsight[] = ["Learning Python", "Playing football"].map((statement, index) => ({
    id: `i${index}`, dimension: "knowledge_structure", statement, origin: "user_statement", status: "confirmed",
    evidence: [{ conversationId: "c1", messageId: "m1", excerpt: statement }],
  }));
  assert.equal(selectChatInsights(insights, "How to learn PYTHON?")[0].id, "i0");
});
