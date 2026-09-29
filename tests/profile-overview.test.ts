import test from "node:test";
import assert from "node:assert/strict";
import { buildProfileOverview } from "../src/lib/profile/overview.ts";
import type { ProfileInsight } from "../src/types/cognitive.ts";
import type { Conversation } from "../src/lib/chat/store.ts";

const conversation: Conversation = {
  id: "c1", title: "测试", createdAt: "2026-09-28T00:00:00Z", updatedAt: "2026-09-28T00:00:00Z",
  messages: [{ id: "m1", role: "user", content: "我喜欢先列出几个方案。", createdAt: "2026-09-28T00:00:00Z" }],
};
const base: ProfileInsight = {
  id: "i1", dimension: "cognitive_architecture", statement: "会先列方案。", origin: "ai_inference",
  status: "confirmed", evidence: [{ conversationId: "c1", messageId: "m1", excerpt: "先列出几个方案" }],
};

test("overview always includes seven dimensions and counts only sourced confirmations", () => {
  const groups = buildProfileOverview([
    base,
    { ...base, id: "i2", status: "candidate", dimension: "behavioral_patterns" },
    { ...base, id: "i3", dimension: "values_and_beliefs", evidence: [{ ...base.evidence[0], excerpt: "不存在的原话" }] },
    { ...base, id: "i4", status: "rejected", dimension: "personality" },
  ], [conversation]);
  assert.equal(groups.length, 7);
  assert.deepEqual(groups.find((group) => group.dimension === "cognitive_architecture")?.active.map((item) => item.id), ["i1"]);
  assert.deepEqual(groups.find((group) => group.dimension === "behavioral_patterns")?.pending.map((item) => item.id), ["i2"]);
  assert.deepEqual(groups.find((group) => group.dimension === "values_and_beliefs")?.invalid.map((item) => item.id), ["i3"]);
  assert.deepEqual(groups.find((group) => group.dimension === "personality")?.rejected.map((item) => item.id), ["i4"]);
  assert.equal(groups.find((group) => group.dimension === "social_relations")?.active.length, 0);
});
