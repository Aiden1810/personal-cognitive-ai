import assert from "node:assert/strict";
import test from "node:test";
import { compareRecentOutcomes, createOutcomeStore, OUTCOME_STORAGE_KEY, summarizeOutcomes } from "../src/lib/outcomes/store.ts";
import type { UserGoal } from "../src/types/cognitive.ts";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    raw: (key: string) => values.get(key),
  };
}

const goal: UserGoal = {
  id: "goal-1", dimension: "behavioral_patterns", intention: "先做题再整理资料", status: "active",
};

test("a self-reported outcome survives reopening even when its goal later changes", () => {
  const storage = memoryStorage();
  const store = createOutcomeStore(storage);
  store.add(goal, "先做了二十分钟题", "完成两道题", "toward");
  const saved = createOutcomeStore(storage).getState().entries[0];
  assert.equal(saved.goalIntention, "先做题再整理资料");
  assert.equal(saved.result, "完成两道题");
  assert.equal(saved.rating, "toward");
  assert.deepEqual(summarizeOutcomes([saved]), { toward: 1, unclear: 0, away: 0 });
});

test("outcome records require an actual action and result", () => {
  const store = createOutcomeStore(memoryStorage());
  assert.throws(() => store.add(goal, "  ", "完成两道题", "toward"), /实际选择/);
  assert.throws(() => store.add(goal, "先做题", "  ", "toward"), /结果/);
  assert.equal(store.getState().entries.length, 0);
});

test("corrupt feedback is reported without replacing the original data", () => {
  const storage = memoryStorage();
  storage.setItem(OUTCOME_STORAGE_KEY, "broken");
  assert.throws(() => createOutcomeStore(storage).getState(), /格式损坏/);
  assert.equal(storage.raw(OUTCOME_STORAGE_KEY), "broken");
});

test("recent self-reports are compared with the previous three for the same goal", () => {
  const store = createOutcomeStore(memoryStorage());
  for (const rating of ["away", "unclear", "toward", "toward", "toward", "unclear"] as const) {
    store.add(goal, "做了一次选择", "记录了结果", rating);
  }
  const comparison = compareRecentOutcomes(store.getState().entries, goal.id);
  assert.deepEqual(comparison, { recentToward: 2, previousToward: 1, recentAway: 0, previousAway: 1 });
  assert.equal(compareRecentOutcomes(store.getState().entries.slice(0, 5), goal.id), null);
});
