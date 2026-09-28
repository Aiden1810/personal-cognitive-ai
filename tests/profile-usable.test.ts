import test from "node:test";
import assert from "node:assert/strict";
import { usableProfileInsights } from "../src/lib/profile/usable.ts";
import type { ProfileInsight } from "../src/types/cognitive.ts";
import type { Conversation } from "../src/lib/chat/store.ts";

const conversation: Conversation = {
  id: "c1", title: "test", createdAt: "2026-09-28T00:00:00Z", updatedAt: "2026-09-28T00:00:00Z",
  messages: [{ id: "m1", role: "user", content: "我喜欢先列出方案再决定。", createdAt: "2026-09-28T00:00:00Z" }],
};
const insight: ProfileInsight = {
  id: "i1", dimension: "cognitive_architecture", statement: "我倾向先列方案。",
  origin: "ai_inference", status: "confirmed",
  evidence: [{ conversationId: "c1", messageId: "m1", excerpt: "我喜欢先列出方案" }],
};

test("only confirmed insights with intact user evidence are usable", () => {
  assert.deepEqual(usableProfileInsights([insight], [conversation]), [insight]);
  assert.deepEqual(usableProfileInsights([{ ...insight, status: "candidate" }], [conversation]), []);
  assert.deepEqual(usableProfileInsights([insight], []), []);
  assert.deepEqual(usableProfileInsights([{ ...insight, evidence: [{ ...insight.evidence[0], excerpt: "不存在的句子" }] }], [conversation]), []);
  assert.deepEqual(usableProfileInsights([{ ...insight, evidence: [{ ...insight.evidence[0], messageId: "m2" }] }], [conversation]), []);
});
