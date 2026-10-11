import assert from "node:assert/strict";
import test from "node:test";
import { ASSESSMENT_STORAGE_KEY, createAssessmentStore, selectCurrentAssessment } from "../src/lib/profile/assessment.ts";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    raw: (key: string) => values.get(key),
  };
}

test("user labels and tension notes persist without changing profile insights", () => {
  const storage = memoryStorage();
  const store = createAssessmentStore(storage);
  store.setLabel("i1", "strength");
  store.addTension("i1", "i2", "这两条在不同情境下似乎不一致");
  const state = createAssessmentStore(storage).getState();
  assert.equal(state.labels.i1, "strength");
  assert.equal(state.tensions[0].note, "这两条在不同情境下似乎不一致");
  assert.equal(selectCurrentAssessment(state, new Set(["i1"])).tensions.length, 0);
  assert.equal(selectCurrentAssessment(state, new Set(["i1", "i2"])).tensions.length, 1);
});

test("the same insight cannot be compared with itself", () => {
  const store = createAssessmentStore(memoryStorage());
  assert.throws(() => store.addTension("i1", "i1", "同一条"), /不同/);
});

test("corrupt assessment does not erase saved data", () => {
  const storage = memoryStorage();
  storage.setItem(ASSESSMENT_STORAGE_KEY, "broken");
  assert.throws(() => createAssessmentStore(storage).getState(), /格式损坏/);
  assert.equal(storage.raw(ASSESSMENT_STORAGE_KEY), "broken");
});
