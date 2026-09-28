import assert from "node:assert/strict";
import test from "node:test";
import { requestProfileCandidates } from "../src/lib/profile/api.ts";
import type { Conversation } from "../src/lib/chat/store.ts";

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
