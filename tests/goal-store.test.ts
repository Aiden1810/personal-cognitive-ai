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
  assert.equal(updated.status, "paused", "编辑目标不会自动重新启用");
  assert.equal(updated.intention, "先确认问题再列方案");
  store.pause(updated.id);
  store.resume(updated.id);
  assert.equal(store.getActiveGoals().length, 1);
  store.delete(updated.id);
  assert.equal(store.getState().goals.length, 0);
});

test("改变意愿可以保存、修改、清除，旧目标保持未设置", () => {
  const storage = memoryStorage();
  const store = createGoalStore(storage);
  const old = store.upsert("behavioral_patterns", "先做最重要的事");
  assert.equal(old.willingness, undefined);
  const updated = store.upsert("behavioral_patterns", old.intention, "strong");
  assert.equal(updated.id, old.id);
  assert.equal(createGoalStore(storage).getState().goals[0].willingness, "strong");
  assert.equal(store.upsert("behavioral_patterns", "先做核心任务").willingness, "strong");
  store.pause(old.id);
  assert.equal(store.upsert("behavioral_patterns", old.intention, "not_now").status, "paused");
  store.upsert("behavioral_patterns", old.intention, null);
  assert.equal(createGoalStore(storage).getState().goals[0].willingness, undefined);
});

test("非法意愿等级不能写入，损坏等级不会被静默覆盖", () => {
  const storage = memoryStorage();
  const store = createGoalStore(storage);
  const old = store.upsert("behavioral_patterns", "先做核心任务");
  const before = storage.raw(GOAL_STORAGE_KEY);
  // @ts-expect-error Exercise runtime validation of untrusted input.
  assert.throws(() => store.upsert("behavioral_patterns", old.intention, 75), /改变意愿/);
  assert.equal(storage.raw(GOAL_STORAGE_KEY), before);
  storage.setItem(GOAL_STORAGE_KEY, JSON.stringify({ version: 1, goals: [{ ...old, willingness: "unknown" }] }));
  assert.throws(() => store.getState(), /格式损坏/);
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
