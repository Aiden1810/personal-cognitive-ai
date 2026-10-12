import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import type { ProfileInsight, UserGoal } from "../src/types/cognitive.ts";
import { selectChatContext } from "../src/lib/chat/context.ts";

// Synthetic examples only; no real user records are sent to a model.
const question = "我想改掉拖延，现在已经习惯早起了，今天复习了一小时。";
const insight: ProfileInsight = {
  id: "i1", dimension: "behavioral_patterns", statement: "晚上经常熬夜到1点",
  status: "confirmed", origin: "user_statement",
  evidence: [{ conversationId: "c1", messageId: "m1", excerpt: "晚上经常熬夜到1点" }],
};
const goal: UserGoal = {
  id: "g1", dimension: "knowledge_structure", intention: "每天先做20分钟复习题", status: "active",
};
const context = { question, insights: [insight], goals: [goal] };
const modelOutput = {
  suggestedGoal: { dimension: "behavioral_patterns", intention: "每天早上列出3件最重要的事", reason: "你表达了改变拖延的意愿", excerpt: "我想改掉拖延" },
  suggestedArchive: { insightId: "i1", reason: "你提到作息发生变化，旧记忆可能需要核对", excerpt: "现在已经习惯早起了" },
  suggestedOutcome: { goalId: "g1", action: "今天复习了一小时", result: "", reason: "可以记录与复习目标相关的行动", excerpt: "今天复习了一小时" },
};

async function suggestions() {
  assert.ok(existsSync(new URL("../src/lib/chat/suggestions.ts", import.meta.url)), "结构化建议模块尚未实现");
  return import("../src/lib/chat/suggestions.ts");
}

test("three suggestion kinds carry only verified target snapshots and user quotes", async () => {
  const { parseSuggestedActions } = await suggestions();
  const actions = parseSuggestedActions(modelOutput, context);
  assert.deepEqual(actions.map((item) => item.kind), ["goal", "archive", "outcome"]);
  assert.equal(actions[1].kind === "archive" && actions[1].insightStatement, insight.statement);
  assert.equal(actions[2].kind === "outcome" && actions[2].goalIntention, goal.intention);
  assert.equal(actions[2].kind === "outcome" && actions[2].result, "");
});

test("invented memory and goal IDs cannot produce executable suggestions", async () => {
  const { parseSuggestedActions } = await suggestions();
  const actions = parseSuggestedActions({ ...modelOutput,
    suggestedArchive: { ...modelOutput.suggestedArchive, insightId: "invented" },
    suggestedOutcome: { ...modelOutput.suggestedOutcome, goalId: "invented" },
  }, context);
  assert.deepEqual(actions.map((item) => item.kind), ["goal"]);
});

test("unconfirmed memories and paused goals are excluded", async () => {
  const { parseSuggestedActions } = await suggestions();
  assert.deepEqual(parseSuggestedActions(modelOutput, { ...context,
    insights: [{ ...insight, status: "candidate" }], goals: [{ ...goal, status: "paused" }],
  }).map((item) => item.kind), ["goal"]);
});

test("quotes absent from the latest user message are discarded", async () => {
  const { parseSuggestedActions } = await suggestions();
  assert.deepEqual(parseSuggestedActions(modelOutput, { ...context, question: "解释一下Python函数" }), []);
});

test("a changed sleep routine can retrieve the old late-night memory for archive review", () => {
  const selection = selectChatContext([{ role: "user", content: "我现在已经习惯早起了" }], [insight], []);
  assert.deepEqual(selection.insights.map((item) => item.id), ["i1"]);
  assert.deepEqual(selectChatContext([{ role: "user", content: "解释一下Python函数" }], [insight], []).insights, []);
});

test("malformed and oversized suggestions are discarded while valid ones survive", async () => {
  const { parseSuggestedActions } = await suggestions();
  const actions = parseSuggestedActions({ ...modelOutput,
    suggestedGoal: { ...modelOutput.suggestedGoal, dimension: "diagnosis" },
    suggestedOutcome: { ...modelOutput.suggestedOutcome, action: "字".repeat(501) },
  }, context);
  assert.deepEqual(actions.map((item) => item.kind), ["archive"]);
  assert.throws(() => parseSuggestedActions({ random: true }, context), /结构化/);
  assert.deepEqual(parseSuggestedActions({ suggestedGoal: null, suggestedArchive: null, suggestedOutcome: null }, context), []);
});

test("persisted suggestions validate their source, status and payload", async () => {
  const { bindChatSuggestions, isChatSuggestion, parseSuggestedActions } = await suggestions();
  const actions = bindChatSuggestions(parseSuggestedActions(modelOutput, context), "m2");
  assert.equal(actions.length, 3);
  assert.ok(actions.every(isChatSuggestion));
  assert.ok(actions.every((item) => item.status === "pending" && item.sourceMessageId === "m2"));
  assert.equal(new Set(actions.map((item) => item.id)).size, 3);
  assert.equal(isChatSuggestion({ ...actions[0], status: "auto_saved" }), false);
  assert.equal(isChatSuggestion({ ...actions[0], sourceMessageId: "" }), false);
  for (const status of [["pending"], { state: "pending" }, 0, null]) {
    assert.equal(isChatSuggestion({ ...actions[0], status }), false, "status must be a string literal");
  }
});

async function ai() {
  assert.ok(existsSync(new URL("../src/lib/ai/suggestions.ts", import.meta.url)), "建议检测服务尚未实现");
  return import("../src/lib/ai/suggestions.ts");
}

test("suggestion model uses current user statement and filtered context without old assistant claims", async () => {
  const { parseSuggestionRequest, generateChatSuggestions } = await ai();
  let sent: { messages: { role: string; content: string }[]; response_format: unknown } | undefined;
  const input = parseSuggestionRequest({
    messages: [{ role: "assistant", content: "旧助手说：已经完成所有目标" }, { role: "user", content: question }],
    insights: [insight], goals: [goal], reply: "可以核对目标和旧记忆。",
  });
  const actions = await generateChatSuggestions(input, {
    apiKey: "test-key", model: "deepseek-flash", fetcher: async (_url, init) => {
      sent = JSON.parse(String(init?.body));
      return Response.json({ choices: [{ message: { content: JSON.stringify(modelOutput) } }] });
    },
  });
  assert.equal(actions.length, 3);
  assert.deepEqual(sent?.response_format, { type: "json_object" });
  assert.match(sent!.messages[0].content, /不执行|不能执行/);
  assert.match(sent!.messages[0].content, /否定|假设/);
  assert.doesNotMatch(JSON.stringify(sent), /旧助手说/);
});

test("suggestion failures do not invent cards", async () => {
  const { parseSuggestionRequest, generateChatSuggestions } = await ai();
  const input = parseSuggestionRequest({ messages: [{ role: "user", content: question }], reply: "建议核对。" });
  await assert.rejects(generateChatSuggestions(input, { apiKey: "", model: "test", fetcher: async () => { throw new Error("must not call"); } }), /API Key/);
  await assert.rejects(generateChatSuggestions(input, { apiKey: "test", model: "test", fetcher: async () => Response.json({ choices: [{ message: { content: "invalid JSON" } }] }) }), /结构化/);
  await assert.rejects(generateChatSuggestions(input, { apiKey: "test", model: "test", fetcher: async () => Response.json({ choices: [{ finish_reason: "length", message: { content: "{}" } }] }) }), /截断/);
  assert.throws(() => parseSuggestionRequest({ messages: [{ role: "user", content: question }], reply: "" }), /回复/);
});
