import assert from "node:assert/strict";
import test from "node:test";
import { requestAssistantReply } from "../src/lib/chat/api.ts";
import type { ChatMessage } from "../src/lib/chat/store.ts";

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
  await requestAssistantReply([message(0, "user")], [
    {
      id: "i1", dimension: "behavioral_patterns", statement: "用户提到会增加功能",
      origin: "ai_inference", status: "candidate",
      evidence: [{ conversationId: "c1", messageId: "m1", excerpt: "增加功能" }],
    },
    {
      id: "i2", dimension: "behavioral_patterns", statement: "用户希望先完成核心流程",
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
  await requestAssistantReply([message(0, "user")], [], [
    { id: "g1", dimension: "behavioral_patterns", intention: "先完成当前任务", status: "active" },
    { id: "g2", dimension: "values_and_beliefs", intention: "暂停中的目标", status: "paused" },
  ], async (_url, init) => {
    sent = JSON.parse(String(init?.body));
    return Response.json({ ok: true, data: { reply: "好的" } });
  });
  assert.deepEqual((sent as { goals: { id: string }[] }).goals.map((goal) => goal.id), ["g1"]);
});
