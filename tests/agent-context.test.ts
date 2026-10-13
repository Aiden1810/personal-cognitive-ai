import assert from "node:assert/strict";
import test from "node:test";
import { selectAgentContext } from "../src/lib/agent/context.ts";
import type { ProfileInsight } from "../src/types/cognitive.ts";

function insight(id: string, statement: string, status: ProfileInsight["status"] = "confirmed"): ProfileInsight {
  return { id, statement, status, dimension: "knowledge_structure", origin: "user_statement", scope: "preference",
    evidence: [{ conversationId: "synthetic", messageId: id, excerpt: statement }] };
}

test("agent retrieves explicit resource preferences and learning background without using trait levels", () => {
  const records = [insight("cn", "我更喜欢中文资料"), insight("python", "我的 Python 基础一般"), insight("free", "我希望资料免费"), insight("unconfirmed", "我英语不好", "candidate")];
  const context = selectAgentContext("帮我找 PyTorch 学习资料", records, []);
  assert.deepEqual(new Set(context.insights.map((item) => item.id)), new Set(["cn", "python", "free"]));
  assert.ok(context.insights.every((item) => item.status === "confirmed"));
});

test("agent honors one-turn exclusions and disabled background", () => {
  const context = selectAgentContext("不要参考我的画像或个人背景，找 Python 资料", [insight("cn", "我更喜欢中文资料")], [], undefined,
    { enabled: true, background: "合成背景：本科生", instructions: "先讲步骤", updatedAt: "2026-10-12T00:00:00Z" });
  assert.equal(context.insights.length, 0);
  assert.equal(context.personalContext?.background, "");
  assert.equal(context.personalContext?.instructions, "先讲步骤");
  const disabled = selectAgentContext("找资料", [], [], undefined,
    { enabled: false, background: "不应发送", instructions: "", updatedAt: "2026-10-12T00:00:00Z" });
  assert.equal(disabled.personalContext, undefined);
});
