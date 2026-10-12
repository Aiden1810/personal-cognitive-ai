import assert from "node:assert/strict";
import test from "node:test";
import { selectChatContext, serializeChatContext } from "../src/lib/chat/context.ts";
import type { ProfileInsight, UserGoal } from "../src/types/cognitive.ts";

function profile(id: string, statement: string, status: ProfileInsight["status"] = "confirmed"): ProfileInsight {
  return { id, statement, dimension: "behavioral_patterns", status, origin: "user_statement", evidence: [{ conversationId: "synthetic", messageId: id, excerpt: statement }] };
}
const history = [{ role: "user" as const, content: "遇到催促时我该如何平静下来？" }];

// Injected similarities test selection mechanics only, not embedding quality.
test("a strong semantic paraphrase can retrieve a confirmed statement without a literal match", () => {
  const memory = profile("pressure", "别人不断催我时，我会紧张到难以思考");
  const selected = selectChatContext(history, [memory], [], undefined, { model: "test-model", insights: { pressure: 0.84 }, goals: {} });
  assert.deepEqual(selected.insights.map((item) => item.id), ["pressure"]);
  assert.equal(selected.reasons[0].semanticSimilarity, 0.84);
  assert.equal(selected.retrieval?.method, "hybrid");
});

test("semantic similarity cannot activate unconfirmed, archived or evidence-free profiles", () => {
  const memories = [profile("pending", "我会紧张", "candidate"), profile("old", "我会紧张", "archived"), { ...profile("empty", "我会紧张"), evidence: [] }];
  const selected = selectChatContext(history, memories, [], undefined, { model: "test-model", insights: { pending: 0.99, old: 0.99, empty: 0.99 }, goals: {} });
  assert.deepEqual(selected.insights, []);
});

test("a semantic match cannot bypass an explicit profile opt-out or a known course mismatch", () => {
  const memory = profile("english", "英语长文我会分段精读");
  const scores = { model: "test-model", insights: { english: 0.98 }, goals: {} };
  assert.deepEqual(selectChatContext([{ role: "user", content: "不要参考我的画像，只解释英文文章" }], [memory], [], undefined, scores).insights, []);
  assert.deepEqual(selectChatContext([{ role: "user", content: "线性代数的矩阵怎么计算？" }], [memory], [], undefined, scores).insights, []);
});

test("low or invalid similarity does not fill unused context slots", () => {
  const memories = [profile("diet", "饮食偏清淡"), profile("trip", "喜欢到海边度假"), profile("bad", "爱看小说")];
  const selected = selectChatContext(history, memories, [], undefined, { model: "test-model", insights: { diet: 0.22, trip: Number.NaN, bad: 1.1 }, goals: {} });
  assert.deepEqual(selected.insights, []);
});

test("hybrid goals remain separate, active and inside the shared context budget", () => {
  const goals: UserGoal[] = [
    { id: "calm", dimension: "behavioral_patterns", intention: "先缓和紧张，再作决定", status: "active" },
    { id: "paused", dimension: "behavioral_patterns", intention: "遇事冷静", status: "paused" },
  ];
  const selected = selectChatContext(history, [profile("pressure", "他人连续催我会让我紧张")], goals, undefined,
    { model: "test-model", insights: { pressure: 0.8 }, goals: { calm: 0.83, paused: 0.99 } });
  assert.deepEqual(selected.goals.map((item) => item.id), ["calm"]);
  assert.ok(serializeChatContext(selected.insights, selected.goals).length <= 3000);
  assert.deepEqual(selected.insights[0].evidence[0].excerpt, "他人连续催我会让我紧张");
});

test("a direct no-profile request is honored even without a reference verb", () => {
  const selected = selectChatContext([{ role: "user", content: "不需要画像，请解释数据库的联合索引" }],
    [profile("db", "数据库课我混淆联合索引")], [], undefined, { model: "test-model", insights: { db: 0.99 }, goals: {} });
  assert.deepEqual(selected.insights, []);
  assert.equal(selected.profileExcludedByRequest, true);
});

test("database questions do not pull operating-system-specific course facts", () => {
  const memories = [profile("db", "数据库课程里我容易弄混联合索引的列顺序"), profile("os", "操作系统课程里我混淆页表和缓存")];
  const selected = selectChatContext([{ role: "user", content: "数据库课程的联合索引怎样选择列顺序？" }], memories, [], undefined,
    { model: "test-model", insights: { db: 0.9, os: 0.9 }, goals: {} });
  assert.deepEqual(selected.insights.map((item) => item.id), ["db"]);
});

test("a missing semantic score cannot outrank a strong semantic match merely by retaining raw lexical scale", () => {
  const memories = [profile("lexical", "我用笔记归纳要点"), profile("semantic", "我会重述新材料")];
  const selected = selectChatContext([{ role: "user", content: "怎么用笔记归纳要点？" }], memories, [], undefined,
    { model: "test-model", insights: { semantic: 0.85 }, goals: {} });
  assert.equal(selected.insights[0].id, "semantic");
});
