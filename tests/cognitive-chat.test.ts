import assert from "node:assert/strict";
import test from "node:test";
import {
  buildModelMessages,
  generateChatReply,
  parseChatRequest,
} from "../src/lib/ai/chat.ts";

const validRequest = {
  messages: [{ role: "user", content: "我总是临近截止又想加功能，该怎么办？" }],
  insights: [
    {
      id: "i1",
      dimension: "behavioral_patterns",
      statement: "临近截止时仍会增加非核心功能",
      status: "confirmed",
      origin: "ai_inference",
      evidence: [{ conversationId: "c1", messageId: "m1", excerpt: "上次又加了两个功能" }],
    },
    {
      id: "i2",
      dimension: "values_and_beliefs",
      statement: "我相信自己永远不会犹豫",
      status: "candidate",
      origin: "ai_inference",
      evidence: [{ conversationId: "c1", messageId: "m2", excerpt: "有时我会犹豫" }],
    },
  ],
  goals: [
    {
      id: "g1",
      dimension: "behavioral_patterns",
      intention: "截止前优先完成核心流程",
      status: "active",
    },
  ],
};

test("only confirmed insights and active goals shape the assistant context", () => {
  const messages = buildModelMessages(parseChatRequest(validRequest));
  const serialized = JSON.stringify(messages);
  assert.match(serialized, /临近截止时仍会增加非核心功能/);
  assert.match(serialized, /上次又加了两个功能/);
  assert.match(serialized, /截止前优先完成核心流程/);
  assert.doesNotMatch(serialized, /我相信自己永远不会犹豫/);
  assert.equal(messages.at(-1)?.role, "user");
});

test("a chat request must end with a nonempty user message", () => {
  assert.throws(
    () => parseChatRequest({ ...validRequest, messages: [{ role: "assistant", content: "你好" }] }),
    /最后一条.*用户/,
  );
  assert.throws(
    () => parseChatRequest({ ...validRequest, messages: [{ role: "user", content: "  " }] }),
    /消息内容/,
  );
});

test("missing model configuration fails before any network request", async () => {
  await assert.rejects(
    generateChatReply(parseChatRequest(validRequest), {
      apiKey: "",
      model: "deepseek-flash",
      fetcher: () => { throw new Error("network should not be called"); },
    }),
    /尚未配置/,
  );
});

test("model response returns actual reply and sends the full conversation", async () => {
  const request = parseChatRequest({
    ...validRequest,
    messages: [
      { role: "user", content: "你好" },
      { role: "assistant", content: "你好，今天想聊什么？" },
      { role: "user", content: "我想继续聊比赛" },
    ],
  });
  let sent: unknown;
  const reply = await generateChatReply(request, {
    apiKey: "test-key",
    model: "deepseek-flash",
    fetcher: async (_url, init) => {
      sent = JSON.parse(String(init?.body));
      return Response.json({ choices: [{ message: { role: "assistant", content: "先完成核心流程。" } }] });
    },
  });
  assert.equal(reply, "先完成核心流程。");
  assert.deepEqual(
    (sent as { messages: { role: string }[] }).messages.map((message) => message.role),
    ["system", "user", "assistant", "user"],
  );
});

test("invalid provider output is reported without a fabricated reply", async () => {
  await assert.rejects(
    generateChatReply(parseChatRequest(validRequest), {
      apiKey: "test-key",
      model: "deepseek-flash",
      fetcher: async () => Response.json({ choices: [{ message: { content: null } }] }),
    }),
    /没有返回可用的文字/,
  );
});
