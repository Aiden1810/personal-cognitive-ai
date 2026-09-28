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
  const reply = await requestAssistantReply(history, async (_url, init) => {
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
    requestAssistantReply([message(0, "user")], async () =>
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
    requestAssistantReply([message(0, "user")], async () =>
      Response.json({ ok: true, data: { reply: "" } })
    ),
    /没有返回可用的回复/,
  );
});
