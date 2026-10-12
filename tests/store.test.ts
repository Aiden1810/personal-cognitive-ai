import assert from "node:assert/strict";
import test from "node:test";
import { createDemoStore, STORAGE_KEY } from "../src/lib/data/store.ts";
import { createDemoState } from "../src/lib/data/fixtures.ts";
import type { StorageAdapter } from "../src/lib/data/store.ts";
import type { DecisionComparison } from "../src/types/domain.ts";

function memoryStorage(): StorageAdapter {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

test("case updates survive reopening the store instead of being replaced by fixtures", () => {
  const storage = memoryStorage();
  const store = createDemoStore(storage);
  const record = store.getState().cases[0];
  store.saveCase({ ...record, title: "用户修改的记录" });
  assert.equal(
    createDemoStore(storage).getState().cases[0].title,
    "用户修改的记录",
  );
});

test("malformed saved data reports failure without silently overwriting the user's data", () => {
  const storage = memoryStorage();
  storage.setItem(STORAGE_KEY, '{"contractVersion":"0.1","cases":null}');
  const store = createDemoStore(storage);
  assert.throws(() => store.getState(), /本地数据/);
  assert.equal(
    storage.getItem(STORAGE_KEY),
    '{"contractVersion":"0.1","cases":null}',
  );
  store.reset();
  assert.equal(store.getState().cases.length, 2);
});

test("rejected patterns deactivate linked goals but do not create goals automatically", () => {
  const store = createDemoStore(memoryStorage());
  const pattern = store.getState().patterns[0];
  store.savePattern({ ...pattern, status: "confirmed" });
  assert.equal(store.getState().goals.length, 1);
  store.saveGoal({
    ...store.getState().goals[0],
    status: "active",
    patternId: pattern.id,
  });
  store.savePattern({ ...pattern, status: "rejected" });
  assert.equal(store.getState().goals[0].status, "inactive");
});

test("blank case input cannot be saved and leaves prior state intact", () => {
  const store = createDemoStore(memoryStorage());
  const record = store.getState().cases[0];
  assert.throws(() => store.saveCase({ ...record, title: "   " }), /标题/);
  assert.equal(store.getState().cases[0].title, "占位记录 · 一次选择");
});

test("editing a confirmed pattern requires reconfirmation and deactivates its goal", () => {
  const store = createDemoStore(memoryStorage());
  const pattern = store.getState().patterns[0];
  store.savePattern({ ...pattern, status: "confirmed" });
  store.saveGoal({
    ...store.getState().goals[0],
    status: "active",
    patternId: pattern.id,
  });
  store.savePattern({
    ...store.getState().patterns[0],
    description: "用户修改的观察",
  });
  assert.equal(store.getState().patterns[0].status, "pending");
  assert.equal(store.getState().goals[0].status, "inactive");
});

test("a goal cannot activate against an unconfirmed pattern", () => {
  const store = createDemoStore(memoryStorage());
  assert.throws(
    () =>
      store.saveGoal({
        ...store.getState().goals[0],
        status: "active",
        patternId: "sample-pattern-1",
      }),
    /已确认模式/,
  );
});

test("editing pattern caveats or user notes requires reconfirmation", () => {
  for (const change of [
    { caveats: ["新增限制条件"] },
    { userNote: "用户补充说明" },
  ]) {
    const store = createDemoStore(memoryStorage());
    const initial = store.getState();
    store.savePattern({ ...initial.patterns[0], status: "confirmed" });
    store.saveGoal({
      ...initial.goals[0],
      status: "active",
      patternId: "sample-pattern-1",
    });
    store.savePattern({ ...store.getState().patterns[0], ...change });
    assert.equal(store.getState().patterns[0].status, "pending");
    assert.equal(store.getState().goals[0].status, "inactive");
  }
});

test("moving a case to another scenario removes old pattern references", () => {
  const store = createDemoStore(memoryStorage());
  const initial = store.getState();
  store.savePattern({ ...initial.patterns[0], status: "confirmed" });
  store.saveGoal({
    ...initial.goals[0],
    status: "active",
    patternId: "sample-pattern-1",
  });
  store.saveCase({ ...initial.cases[0], scenario: "another-scenario" });
  const after = store.getState();
  assert.deepEqual(after.patterns[0].supportCaseIds, []);
  assert.equal(after.patterns[0].status, "pending");
  assert.equal(after.goals[0].status, "inactive");
  assert.doesNotThrow(() => store.savePattern(after.patterns[0]));
});

test("explicit rejection stays rejected even when pattern text is edited", () => {
  const store = createDemoStore(memoryStorage());
  store.savePattern({ ...store.getState().patterns[0], status: "confirmed" });
  store.savePattern({
    ...store.getState().patterns[0],
    description: "用户纠正了观察",
    status: "rejected",
  });
  assert.equal(store.getState().patterns[0].status, "rejected");
});

test("unknown or cross-scenario evidence is rejected", () => {
  const store = createDemoStore(memoryStorage());
  assert.throws(
    () =>
      store.savePattern({
        ...store.getState().patterns[0],
        supportCaseIds: ["does-not-exist"],
      }),
    /证据/,
  );
});

test("storage write failures are surfaced without pretending a change was saved", () => {
  const state = JSON.stringify(createDemoState());
  const storage: StorageAdapter = {
    getItem: () => state,
    setItem: () => {
      throw new Error("quota exceeded");
    },
  };
  const store = createDemoStore(storage);
  assert.throws(
    () => store.saveCase({ ...store.getState().cases[0], title: "未保存修改" }),
    /保存失败/,
  );
  assert.equal(store.getState().cases[0].title, "占位记录 · 一次选择");
});

test("corrupt nested records are rejected before they can reach a page", () => {
  const storage = memoryStorage();
  const state = createDemoState();
  storage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...state, cases: [{ ...state.cases[0], options: 42 }] }),
  );
  assert.throws(() => createDemoStore(storage).getState(), /本地数据/);
});

test("deleting evidence clears dependent comparisons and feedback and invalidates the pattern", () => {
  const store = createDemoStore(memoryStorage());
  const state = store.getState();
  store.savePattern({ ...state.patterns[0], status: "confirmed" });
  store.saveGoal({
    ...state.goals[0],
    patternId: "sample-pattern-1",
    status: "active",
  });
  const ready = store.getState();
  const base = {
    summary: "示例",
    reasoning: "依据摘要",
    status: "ready" as const,
    ruleIds: [],
    caveats: [],
  };
  const comparison: DecisionComparison = {
    id: "comparison-1",
    userId: "demo-user",
    createdAt: "2026-09-27T00:00:00.000Z",
    updatedAt: "2026-09-27T00:00:00.000Z",
    currentDecision: {
      question: "占位问题",
      scenario: "demo-placeholder",
      options: [],
      constraints: [],
    },
    generic: {
      ...base,
      perspective: "generic",
      evidenceCaseIds: [],
      goalId: null,
    },
    original: {
      ...base,
      perspective: "original",
      evidenceCaseIds: ["sample-case-1"],
      goalId: null,
    },
    better: {
      ...base,
      perspective: "better",
      evidenceCaseIds: ["sample-case-1"],
      goalId: "sample-goal-1",
    },
    generationSource: "example",
    modelId: null,
    contractVersion: "0.1",
    rulesVersion: null,
    evidenceSnapshot: ready.cases,
    patternSnapshot: ready.patterns,
    goalSnapshot: ready.goals[0],
  };
  store.saveComparison(comparison);
  store.saveFeedback({
    id: "feedback-1",
    userId: "demo-user",
    createdAt: comparison.createdAt,
    updatedAt: comparison.updatedAt,
    comparisonId: comparison.id,
    actualChoice: "示例选择",
    recordedAt: comparison.createdAt,
    outcome: null,
    outcomeRecordedAt: null,
    userNote: null,
  });
  store.deleteCase("sample-case-1");
  const after = store.getState();
  assert.equal(after.cases.length, 1);
  assert.deepEqual(after.patterns[0].supportCaseIds, []);
  assert.equal(after.patterns[0].status, "pending");
  assert.equal(after.goals[0].status, "inactive");
  assert.equal(after.comparisons.length, 0);
  assert.equal(after.feedback.length, 0);
});
