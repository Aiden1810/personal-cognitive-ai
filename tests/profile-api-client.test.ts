import assert from "node:assert/strict";
import test from "node:test";
import { requestProfileCandidates } from "../src/lib/profile/api.ts";
import type { Conversation } from "../src/lib/chat/store.ts";
import type { ProfileInsight } from "../src/types/cognitive.ts";

const conversation: Conversation = {
  id: "c1",
  title: "比赛",
  createdAt: "2026-09-28T00:00:00.000Z",
  updatedAt: "2026-09-28T00:00:00.000Z",
  messages: [{
    id: "m1",
    role: "user",
    content: "比赛还有五天，我又想加功能",
    createdAt: "2026-09-28T00:00:00.000Z",
  }],
};

const candidate = {
  id: "i1",
  dimension: "behavioral_patterns",
  statement: "用户在比赛前想增加功能",
  origin: "ai_inference",
  status: "candidate",
  evidence: [{ conversationId: "c1", messageId: "m1", excerpt: "我又想加功能" }],
};

test("the client accepts a candidate citing an actual user message", async () => {
  const result = await requestProfileCandidates(conversation, async () =>
    Response.json({ ok: true, data: { candidates: [candidate] } })
  );
  assert.equal(result[0].statement, candidate.statement);
});

test("the client rejects a fabricated citation before local storage", async () => {
  await assert.rejects(
    requestProfileCandidates(conversation, async () =>
      Response.json({ ok: true, data: { candidates: [{
        ...candidate,
        evidence: [{ conversationId: "c1", messageId: "m1", excerpt: "我一直很拖延" }],
      }] } })
    ),
    /证据.*不匹配/,
  );
});

test("the client presents extraction failures to the user", async () => {
  await assert.rejects(
    requestProfileCandidates(conversation, async () =>
      Response.json({ ok: false, error: { message: "画像提取暂时不可用。" } }, { status: 503 })
    ),
    /画像提取暂时不可用/,
  );
});

test("assistant replies do not consume the extraction user-message window", async () => {
  const longConversation: Conversation = { ...conversation, messages: Array.from({ length: 42 }, (_, index) => ({
    ...conversation.messages[0], id: `m${index}`, role: index % 2 === 0 ? "user" : "assistant",
    content: index % 2 === 0 ? `用户经历${index}` : "助手回复".repeat(2500),
  })) };
  let sent: unknown;
  await requestProfileCandidates(longConversation, async (_url, init) => {
    sent = JSON.parse(String(init?.body));
    return Response.json({ ok: true, data: { candidates: [] } });
  });
  const body = sent as { messages: {id: string; role: string}[] };
  assert.equal(body.messages.length, 20);
  assert.equal(body.messages[0].id, "m2");
  assert.equal(body.messages.at(-1)?.id, "m40");
  assert.ok(body.messages.every((item) => item.role === "user"));
});

test("extraction carries bounded existing review records from the selected source messages only", async () => {
  const existing: ProfileInsight[] = Array.from({ length: 35 }, (_, index) => ({
    ...candidate, id: `i${index}`, statement: `已有记录${index}`, status: "rejected",
  } as ProfileInsight));
  existing.push({ ...existing[0], id: "other", evidence: [{ conversationId: "other", messageId: "m1", excerpt: "我又想加功能" }] });
  let sent: unknown;
  await requestProfileCandidates(conversation, async (_url, init) => {
    sent = JSON.parse(String(init?.body));
    return Response.json({ ok: true, data: { candidates: [] } });
  }, existing);
  const body = sent as { existingInsights: {status: string; statement: string}[] };
  assert.equal(body.existingInsights.length, 30);
  assert.ok(body.existingInsights.every((item) => item.status === "rejected"));
  assert.equal(body.existingInsights[0].statement, "已有记录5");
});
