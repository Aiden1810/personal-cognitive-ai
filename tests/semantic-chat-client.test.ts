import assert from "node:assert/strict";
import test from "node:test";
import { requestAssistantReply } from "../src/lib/chat/api.ts";
import type { ChatContextSelection } from "../src/lib/chat/context.ts";
import type { ProfileInsight } from "../src/types/cognitive.ts";

const history = [{ id: "m1", role: "user" as const, content: "答辩前焦虑，担心现场脑袋空白，该怎样缓解压力？", createdAt: "2026-10-09T00:00:00Z" }];
const profiles: ProfileInsight[] = [{ id: "speech", statement: "我面对观众发言时容易紧张，脑中准备好的内容会突然消失。", dimension: "cognitive_architecture", status: "confirmed", origin: "user_statement", evidence: [{ conversationId: "synthetic", messageId: "m0", excerpt: "合成原话，不传入向量服务" }] }];

test("opt-in semantic retrieval sends only statements and attaches its selected original evidence to chat", async () => {
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  let selected: ChatContextSelection | undefined;
  const reply = await requestAssistantReply(history, profiles, [], async (url, init) => {
    requests.push({ url, body: JSON.parse(String(init?.body)) });
    return url === "/api/retrieval/semantic"
      ? Response.json({ data: { model: "test-model", insights: { speech: 0.84 }, goals: {} } })
      : Response.json({ ok: true, data: { reply: "合成回复" } });
  }, (value) => { selected = value; }, undefined, true);
  assert.equal(reply, "合成回复");
  assert.deepEqual(requests.map(({ url }) => url), ["/api/retrieval/semantic", "/api/chat"]);
  assert.deepEqual(requests[0].body, { query: history[0].content, insights: [{ id: "speech", text: profiles[0].statement }], goals: [] });
  assert.equal(selected?.retrieval?.method, "hybrid");
  assert.deepEqual((requests[1].body.insights as ProfileInsight[])[0].evidence, profiles[0].evidence);
});

test("semantic service failure leaves chat usable and reports keyword fallback", async () => {
  let selected: ChatContextSelection | undefined;
  const reply = await requestAssistantReply(history, profiles, [], async (url) => url === "/api/retrieval/semantic"
    ? Response.json({ error: { message: "模型不可用" } }, { status: 503 })
    : Response.json({ ok: true, data: { reply: "合成回复" } }), (value) => { selected = value; }, undefined, true);
  assert.equal(reply, "合成回复");
  assert.equal(selected?.retrieval?.method, "keyword");
  assert.ok(selected?.retrieval?.fallbackReason);
  assert.deepEqual(selected?.insights, []);
});

test("default chat does not call the semantic endpoint", async () => {
  const urls: string[] = [];
  await requestAssistantReply(history, profiles, [], async (url) => {
    urls.push(url);
    return Response.json({ ok: true, data: { reply: "合成回复" } });
  });
  assert.deepEqual(urls, ["/api/chat"]);
});

test("incomplete semantic results fall back and cannot claim hybrid selection", async () => {
  let selected: ChatContextSelection | undefined;
  await requestAssistantReply(history, profiles, [], async (url) => url === "/api/retrieval/semantic"
    ? Response.json({ data: { model: "test-model", insights: {}, goals: {} } })
    : Response.json({ ok: true, data: { reply: "合成回复" } }), (value) => { selected = value; }, undefined, true);
  assert.equal(selected?.retrieval?.method, "keyword");
  assert.ok(selected?.retrieval?.fallbackReason);
});
