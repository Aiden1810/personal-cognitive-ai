import assert from "node:assert/strict";
import test from "node:test";
import { requestAssistantReply } from "../src/lib/chat/api.ts";
import type { ChatMessage } from "../src/lib/chat/store.ts";
import type { ProfileInsight } from "../src/types/cognitive.ts";
import { parseChatRequest } from "../src/lib/ai/chat.ts";

function message(index: number, role: ChatMessage["role"]): ChatMessage {
  return {
    id: `m${index}`,
    role,
    content: `第 ${index} 条消息`,
    createdAt: "2026-09-28T00:00:00.000Z",
  };
}

test("the client sends recent conversation turns and reads a real reply", async () => {
  const history = Array.from({ length: 31 }, (_, index) =>
    message(index, index % 2 === 0 ? "user" : "assistant")
  );
  let sent: unknown;
  const reply = await requestAssistantReply(history, [], [], async (_url, init) => {
    sent = JSON.parse(String(init?.body));
    return Response.json({ ok: true, data: { reply: "先确定最重要的事。" } });
  });
  assert.equal(reply, "先确定最重要的事。");
  const messages = (sent as { messages: { content: string }[] }).messages;
  assert.equal(messages.length, 30);
  assert.equal(messages[0].content, "第 1 条消息");
  assert.equal(messages.at(-1)?.content, "第 30 条消息");
  assert.deepEqual((sent as { insights: unknown[]; goals: unknown[] }).insights, []);
});

test("the client exposes the server error instead of inventing a response", async () => {
  await assert.rejects(
    requestAssistantReply([message(0, "user")], [], [], async () =>
      Response.json(
        { ok: false, error: { code: "LLM_UNAVAILABLE", message: "AI 服务尚未配置 API Key。" } },
        { status: 503 },
      )
    ),
    /尚未配置 API Key/,
  );
});

test("chat errors preserve the server code and HTTP status", async () => {
  await assert.rejects(requestAssistantReply([message(0, "user")], [], [], async () =>
    Response.json({ ok: false, error: { code: "FORBIDDEN", message: "请求来源不允许。" } }, { status: 403 })),
  { name: "AppError", code: "FORBIDDEN", message: "请求来源不允许。", status: 403 });
});

test("network failures keep their original cause", async () => {
  const failure = new TypeError("connection failed");
  await assert.rejects(requestAssistantReply([message(0, "user")], [], [], async () => { throw failure; }),
    { name: "AppError", code: "NETWORK_ERROR", cause: failure });
});

test("a failure envelope in HTTP 200 cannot be mistaken for a reply", async () => {
  await assert.rejects(requestAssistantReply([message(0, "user")], [], [], async () =>
    Response.json({ ok: false, error: { code: "LLM_UNAVAILABLE", message: "服务暂时不可用。" }, data: { reply: "伪成功" } })),
  { code: "LLM_UNAVAILABLE" });
});

test("chat rejects a missing discriminator and conflicting HTTP status", async () => {
  for (const response of [
    Response.json({ data: { reply: "缺少 ok" } }),
    Response.json({ ok: true, data: { reply: "与 HTTP 错误冲突" } }, { status: 503 }),
    Response.json({ ok: false, error: { code: "UNKNOWN_CODE", message: "不可信错误" } }, { status: 500 }),
  ]) {
    await assert.rejects(requestAssistantReply([message(0, "user")], [], [], async () => response),
      { code: "INVALID_RESPONSE" });
  }
});

test("the client rejects an unreadable server response", async () => {
  await assert.rejects(
    requestAssistantReply([message(0, "user")], [], [], async () =>
      Response.json({ ok: true, data: { reply: "" } })
    ),
    /没有返回可用的回复/,
  );
});

test("only accepted insights are sent with later chat questions", async () => {
  let sent: unknown;
  await requestAssistantReply([{ ...message(0, "user"), content: "比赛项目如何安排？" }], [
    {
      id: "i1", dimension: "behavioral_patterns", statement: "用户提到会增加功能",
      origin: "ai_inference", status: "candidate",
      evidence: [{ conversationId: "c1", messageId: "m1", excerpt: "增加功能" }],
    },
    {
      id: "i2", dimension: "behavioral_patterns", statement: "用户希望先完成项目核心流程",
      origin: "user_statement", status: "confirmed",
      evidence: [{ conversationId: "c1", messageId: "m2", excerpt: "先完成核心流程" }],
    },
  ], [], async (_url, init) => {
    sent = JSON.parse(String(init?.body));
    return Response.json({ ok: true, data: { reply: "好的" } });
  });
  assert.deepEqual(
    (sent as { insights: { id: string }[] }).insights.map((item) => item.id),
    ["i2"],
  );
});

test("only active user goals are sent with later chat questions", async () => {
  let sent: unknown;
  await requestAssistantReply([{ ...message(0, "user"), content: "比赛任务先做什么？" }], [], [
    { id: "g1", dimension: "behavioral_patterns", intention: "先完成比赛当前任务", status: "active", willingness: "strong" },
    { id: "g2", dimension: "values_and_beliefs", intention: "暂停中的目标", status: "paused" },
  ], async (_url, init) => {
    sent = JSON.parse(String(init?.body));
    return Response.json({ ok: true, data: { reply: "好的" } });
  });
  assert.deepEqual((sent as { goals: { id: string }[] }).goals.map((goal) => goal.id), ["g1"]);
  assert.equal(parseChatRequest(sent).goals[0].willingness, "strong");
});

test("more than twenty confirmed insights still produce a valid chat request and retain relevant older evidence", async () => {
  const insights: ProfileInsight[] = Array.from({ length: 25 }, (_, index) => ({
    id: `i${index}`, dimension: "behavioral_patterns", statement: `喜欢旅行景点${index}`,
    origin: "user_statement", status: "confirmed",
    evidence: [{ conversationId: "c1", messageId: "m1", excerpt: "虚构资料" }],
  }));
  insights[0].statement = "复习时先整理资料，导致做题时间不足";
  const before = structuredClone(insights);
  let sent: unknown;
  await requestAssistantReply([{ ...message(0, "user"), content: "复习时要先做题吗？" }], insights, [], async (_url, init) => {
    sent = JSON.parse(String(init?.body));
    return Response.json({ ok: true, data: { reply: "可先做题。" } });
  });
  const parsed = parseChatRequest(sent);
  assert.equal(parsed.insights.length, 1);
  assert.equal(parsed.insights[0].id, "i0");
  assert.deepEqual(insights, before, "selection must not delete or reorder saved profiles");
});

test("the request and its reference preview contain the same relevant goal selection", async () => {
  let sent: { goals: { id: string }[] } | undefined;
  let preview: { goals: { id: string }[] } | undefined;
  await requestAssistantReply([{ ...message(0, "user"), content: "复习考试" }], [], [
    { id: "study", dimension: "knowledge_structure", intention: "每天复习", status: "active" },
    { id: "travel", dimension: "narrative_self", intention: "海边旅行", status: "active" },
  ], async (_url, init) => {
    sent = JSON.parse(String(init?.body));
    return Response.json({ ok: true, data: { reply: "先做题。" } });
  }, (selection) => { preview = selection; });
  assert.deepEqual(sent?.goals.map((item) => item.id), ["study"]);
  assert.deepEqual(preview?.goals.map((item) => item.id), ["study"]);
});
