import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { requestAssistantReply } from "../src/lib/chat/api.ts";
import { selectChatContext } from "../src/lib/chat/context.ts";

const history = [{ id: "m1", role: "user" as const, content: "合成案例：我想改掉拖延", createdAt: "2026-10-11T01:00:00Z" }];
const selection = selectChatContext(history, [], []);

async function client() {
  assert.ok(existsSync(new URL("../src/lib/chat/suggestions-api.ts", import.meta.url)), "建议检测客户端尚未实现");
  return import("../src/lib/chat/suggestions-api.ts");
}

test("normal chat remains a single request even when suggestion detection later fails", async () => {
  let count = 0;
  const reply = await requestAssistantReply(history, [], [], async () => { count++; return Response.json({ ok: true, data: { reply: "先从小步骤开始。" } }); });
  assert.equal(reply, "先从小步骤开始。");
  assert.equal(count, 1);
  const { requestChatSuggestions } = await client();
  await assert.rejects(requestChatSuggestions(history, reply, selection, async () => Response.json({ error: { message: "建议检测失败" } }, { status: 503 })), /建议检测失败/);
  assert.equal(reply, "先从小步骤开始。");
});

test("suggestion client sends only this turn and binds validated cards to it", async () => {
  const { requestChatSuggestions } = await client();
  let sent: Record<string, unknown> | undefined;
  const cards = await requestChatSuggestions(history, "先列出重要的事。", selection, async (url, init) => {
    assert.equal(url, "/api/chat/suggestions");
    sent = JSON.parse(String(init?.body));
    return Response.json({ data: { suggestions: [{ kind: "goal", dimension: "behavioral_patterns", intention: "列出3件重要的事", reason: "想改变拖延", excerpt: "我想改掉拖延" }] } });
  });
  assert.deepEqual(sent?.messages, [{ role: "user", content: history[0].content }]);
  assert.equal(cards[0].sourceMessageId, "m1");
  assert.equal(cards[0].status, "pending");
});

test("suggestion client rejects malformed responses instead of treating them as no intent", async () => {
  const { requestChatSuggestions } = await client();
  await assert.rejects(requestChatSuggestions(history, "回复", selection, async () => Response.json({ data: { suggestions: "bad" } })), /建议/);
  assert.deepEqual(await requestChatSuggestions(history, "回复", selection, async () => Response.json({ data: { suggestions: [] } })), []);
});

async function route() {
  assert.ok(existsSync(new URL("../src/app/api/chat/suggestions/route.ts", import.meta.url)), "建议检测接口尚未实现");
  return import("../src/app/api/chat/suggestions/route.ts");
}

function request(body: unknown, origin?: string) {
  return new Request("http://127.0.0.1:3001/api/chat/suggestions", {
    method: "POST", headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify(body),
  });
}

test("suggestion route rejects other origins and malformed bodies before contacting the model", async () => {
  const { POST } = await route();
  assert.equal((await POST(request({ messages: history }, "https://other.example"))).status, 403);
  assert.equal((await POST(request({ messages: [], reply: "回复" }))).status, 400);
  assert.equal((await POST(request({ messages: history, reply: "" }))).status, 400);
});

test("suggestion route returns structured suggestions and respects the production block", async () => {
  const { POST } = await route();
  const old = { key: process.env.LLM_API_KEY, node: process.env.NODE_ENV, fetch: globalThis.fetch };
  const environment: Record<string, string | undefined> = process.env;
  try {
    process.env.LLM_API_KEY = "test-key";
    globalThis.fetch = (async () => Response.json({ choices: [{ message: { content: JSON.stringify({ suggestedGoal: { dimension: "behavioral_patterns", intention: "先做一件重要的事", reason: "用户想改变", excerpt: "我想改掉拖延" }, suggestedArchive: null, suggestedOutcome: null }) } }] })) as typeof fetch;
    const result = await POST(request({ messages: history, reply: "先做重要的事。" }));
    assert.equal(result.status, 200);
    assert.equal((await result.json()).data.suggestions[0].kind, "goal");
    environment.NODE_ENV = "production";
    assert.equal((await POST(request({ messages: history, reply: "回复" }))).status, 503);
  } finally {
    globalThis.fetch = old.fetch;
    if (old.key === undefined) delete process.env.LLM_API_KEY; else process.env.LLM_API_KEY = old.key;
    if (old.node === undefined) delete environment.NODE_ENV; else environment.NODE_ENV = old.node;
  }
});
