import assert from "node:assert/strict";
import test from "node:test";
import { createGoalStore, GOAL_STORAGE_KEY } from "../src/lib/goals/store.ts";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    raw: (key: string) => values.get(key),
  };
}

test("a user goal survives reopening and stays separate from observed insights", () => {
  const storage = memoryStorage();
  const goal = createGoalStore(storage).upsert("behavioral_patterns", "先完成核心工作，再考虑新点子");
  assert.equal(goal.status, "active");
  assert.equal(createGoalStore(storage).getActiveGoals()[0].intention, goal.intention);
  assert.equal(createGoalStore(storage).getState().goals.length, 1);
});

test("editing a dimension replaces its goal and a paused goal is not active", () => {
  const store = createGoalStore(memoryStorage());
  const first = store.upsert("cognitive_architecture", "先列方案");
  store.pause(first.id);
  assert.equal(store.getActiveGoals().length, 0);
  const updated = store.upsert("cognitive_architecture", "先确认问题再列方案");
  assert.equal(updated.id, first.id);
  assert.equal(store.getState().goals.length, 1);
  assert.equal(store.getActiveGoals()[0].intention, "先确认问题再列方案");
  store.pause(updated.id);
  store.resume(updated.id);
  assert.equal(store.getActiveGoals().length, 1);
  store.delete(updated.id);
  assert.equal(store.getState().goals.length, 0);
});

test("invalid or corrupt goals cannot silently enter chat context", () => {
  const storage = memoryStorage();
  const store = createGoalStore(storage);
  assert.throws(() => store.upsert("behavioral_patterns", "   "), /不能为空/);
  assert.equal(store.getState().goals.length, 0);
  storage.setItem(GOAL_STORAGE_KEY, "broken");
  assert.throws(() => store.getState(), /格式损坏/);
  assert.equal(storage.raw(GOAL_STORAGE_KEY), "broken");
});
