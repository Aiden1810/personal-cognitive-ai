import test from "node:test";
import assert from "node:assert/strict";
import { buildQuestionnaireInsights, suggestTraitLevel } from "../src/lib/profile/questionnaire.ts";
import { createProfileStore } from "../src/lib/profile/store.ts";
import { usableProfileInsights } from "../src/lib/profile/usable.ts";
import { createGoalStore } from "../src/lib/goals/store.ts";
import { parseChatRequest, buildModelMessages } from "../src/lib/ai/chat.ts";
import { selectChatContext, serializeChatContext } from "../src/lib/chat/context.ts";
import type { ProfileInsight } from "../src/types/cognitive.ts";
import { selectReflectionSources } from "../src/lib/profile/reflection-api.ts";
import { parseReflectionRequest } from "../src/lib/profile/reflection.ts";

function storage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}
const now = "2026-10-11T04:00:00.000Z";
const answers = { q1: "sometimes", q2: "often", q3: "sometimes" } as const;

test("unknown and inapplicable answers never become a low rating", () => {
  assert.equal(suggestTraitLevel(["unsure", "not_applicable", undefined]), "unknown");
  assert.equal(suggestTraitLevel(["rare", "unsure", undefined]), "unknown");
  assert.equal(suggestTraitLevel(["rare", "often", "often"]), "varied");
  assert.equal(suggestTraitLevel(["sometimes", "often", "sometimes"]), "medium");
  assert.deepEqual(buildQuestionnaireInsights({}, {}, now), []);
});

test("confirmed questionnaire sources work without fabricated conversations", () => {
  const items = buildQuestionnaireInsights(answers, { action_execution: "medium" }, now);
  assert.equal(items.length, 1);
  assert.equal(items[0].dimension, "action_execution");
  assert.equal(items[0].status, "confirmed");
  assert.equal(items[0].currentLevel, "medium");
  assert.equal(items[0].evidence.length, 3);
  assert.ok(items[0].evidence.every((source) => source.kind === "questionnaire" && !("conversationId" in source)));
  assert.deepEqual(usableProfileInsights(items, []), items);
  const store = createProfileStore(storage());
  store.completeQuestionnaire(items);
  assert.equal(store.getState().onboarding?.status, "completed");
  store.removeByConversation("unrelated");
  assert.equal(store.getState().insights.length, 1);
});

test("skip stores no invented profile; storage failures preserve prior data", () => {
  const local = storage();
  const store = createProfileStore(local);
  store.skipQuestionnaire();
  assert.equal(store.getState().onboarding?.status, "skipped");
  assert.deepEqual(store.getState().insights, []);
  const failing = createProfileStore({ getItem: local.getItem, setItem: () => { throw new Error("quota"); } });
  assert.throws(() => failing.completeQuestionnaire(buildQuestionnaireInsights(answers, {}, now)), /保存失败/);
  assert.equal(store.getState().onboarding?.status, "skipped");
  assert.deepEqual(store.getState().insights, []);
});

test("retaking archives only superseded questionnaire records and preserves goals and chat evidence", () => {
  const local = storage();
  const store = createProfileStore(local);
  const legacy: ProfileInsight = { id: "legacy", dimension: "behavioral_patterns", statement: "曾推迟项目开始", origin: "user_statement", status: "candidate", evidence: [{ conversationId: "c", messageId: "m", excerpt: "我上次推迟了" }] };
  store.addCandidates([legacy]); store.confirm("legacy");
  store.completeQuestionnaire(buildQuestionnaireInsights(answers, {}, now));
  const firstId = store.getState().insights.find((item) => item.dimension === "action_execution")!.id;
  createGoalStore(local).upsert("action_execution", "先完成第一步", null, "high");
  store.completeQuestionnaire(buildQuestionnaireInsights({ q1: "often", q2: "often", q3: "often" }, {}, now));
  assert.equal(store.getState().insights.find((item) => item.id === firstId)?.status, "archived");
  assert.equal(store.getState().insights.find((item) => item.id === "legacy")?.status, "confirmed");
  assert.equal(createGoalStore(local).getState().goals[0].targetLevel, "high");
});

test("related chat sends questionnaire sources and separate current and target levels", () => {
  const items = buildQuestionnaireInsights(answers, { action_execution: "low" }, now);
  const local = storage();
  const goals = createGoalStore(local);
  const goal = goals.upsert("action_execution", "任务开始时先完成一个初版", null, "high");
  const selection = selectChatContext([{ role: "user", content: "任务开始时如何完成一个初版？" }], items, [goal]);
  assert.equal(selection.insights.length, 1);
  assert.equal(selection.insights[0].evidence.length, 3);
  const request = parseChatRequest({ messages: [{ role: "user", content: "任务开始时如何完成一个初版？" }], insights: selection.insights, goals: selection.goals });
  const serialized = JSON.parse(serializeChatContext(request.insights, request.goals));
  assert.equal(serialized.confirmedInsights[0].currentLevel.value, "low");
  assert.equal(serialized.userGoals[0].targetLevel.value, "high");
  assert.equal(serialized.confirmedInsights[0].questionnaireResponses[0].answeredAt, "2026-10-11T04:00:00.000Z");
  assert.equal(serialized.confirmedInsights[0].questionnaireResponses[0].questionId, "q1");
  assert.equal(serialized.confirmedInsights[0].questionnaireResponses[0].version, 1);
  assert.match(buildModelMessages(request)[0].content, /用户自评/);
  assert.equal(items[0].currentLevel, "low");
});

test("editing a paused target preserves pause and current profile; invalid levels fail", () => {
  const local = storage(); const goals = createGoalStore(local);
  const goal = goals.upsert("planning", "明确任务步骤", null, "medium");
  goals.pause(goal.id);
  assert.equal(goals.upsert("planning", "明确完成标准", undefined, "high").status, "paused");
  assert.equal(goals.upsert("planning", "保留档位").targetLevel, "high");
  assert.equal(goals.upsert("planning", "清除档位", undefined, null).targetLevel, undefined);
  assert.throws(() => goals.upsert("planning", "非法", null, "invalid" as "high"), /目标档位/);
});

test("reflection preserves when questionnaire self-reports were made", () => {
  const old = buildQuestionnaireInsights(answers, {}, "2026-01-01T00:00:00.000Z");
  const sources = selectReflectionSources(old);
  assert.deepEqual(sources[0].questionnaireAnsweredAt, ["2026-01-01T00:00:00.000Z"]);
  assert.deepEqual(parseReflectionRequest({ insights: sources })[0].questionnaireAnsweredAt, ["2026-01-01T00:00:00.000Z"]);
  assert.throws(() => parseReflectionRequest({ insights: [{ ...sources[0], questionnaireAnsweredAt: ["invalid"] }] }), /资料无效/);
});
