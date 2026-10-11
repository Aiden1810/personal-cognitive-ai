import assert from "node:assert/strict";
import test from "node:test";
import { createChatStore, CHAT_STORAGE_KEY, type StorageAdapter } from "../src/lib/chat/store.ts";
import { createProfileStore, PROFILE_STORAGE_KEY } from "../src/lib/profile/store.ts";
import { createGoalStore, GOAL_STORAGE_KEY } from "../src/lib/goals/store.ts";
import { createResponsePreferenceStore, RESPONSE_PREFERENCES_STORAGE_KEY, DEFAULT_RESPONSE_PREFERENCES } from "../src/lib/preferences/store.ts";
import { createAssessmentStore, ASSESSMENT_STORAGE_KEY } from "../src/lib/profile/assessment.ts";
import { createAutoProfileStore, AUTO_PROFILE_STORAGE_KEY } from "../src/lib/profile/auto.ts";
import { createDemoStore, STORAGE_KEY } from "../src/lib/data/store.ts";

const stores = [
  { name: "chat", key: CHAT_STORAGE_KEY, read: (s: StorageAdapter) => createChatStore(s).getState(), write: (s: StorageAdapter) => createChatStore(s).createConversation() },
  { name: "profile", key: PROFILE_STORAGE_KEY, read: (s: StorageAdapter) => createProfileStore(s).getState(), write: (s: StorageAdapter) => createProfileStore(s).skipQuestionnaire() },
  { name: "goals", key: GOAL_STORAGE_KEY, read: (s: StorageAdapter) => createGoalStore(s).getState(), write: (s: StorageAdapter) => createGoalStore(s).upsert("planning", "先列出今天的任务") },
  { name: "preferences", key: RESPONSE_PREFERENCES_STORAGE_KEY, read: (s: StorageAdapter) => createResponsePreferenceStore(s).getState(), write: (s: StorageAdapter) => createResponsePreferenceStore(s).save(DEFAULT_RESPONSE_PREFERENCES) },
  { name: "assessment", key: ASSESSMENT_STORAGE_KEY, read: (s: StorageAdapter) => createAssessmentStore(s).getState(), write: (s: StorageAdapter) => createAssessmentStore(s).reset() },
  { name: "auto profile", key: AUTO_PROFILE_STORAGE_KEY, read: (s: StorageAdapter) => createAutoProfileStore(s).getState(), write: (s: StorageAdapter) => createAutoProfileStore(s).setEnabled(true, []) },
  { name: "legacy demo", key: STORAGE_KEY, read: (s: StorageAdapter) => createDemoStore(s).getState(), write: (s: StorageAdapter) => createDemoStore(s).reset() },
];

function memoryStorage() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}

function codedError(error: unknown, code: string, cause?: unknown): boolean {
  assert.ok(error instanceof Error);
  assert.equal(error.name, "AppError");
  assert.equal((error as Error & { code: string }).code, code);
  if (cause !== undefined) assert.equal(error.cause, cause);
  return true;
}

for (const store of stores) {
  test(`${store.name}: denied reads remain errors rather than empty data`, () => {
    const failure = new DOMException("blocked", "SecurityError");
    assert.throws(() => store.read({ getItem: () => { throw failure; }, setItem: () => { assert.fail("read must not write"); } }),
      (error) => codedError(error, "STORAGE_ACCESS_DENIED", failure));
  });

  test(`${store.name}: corrupt saved data is reported without overwriting it`, () => {
    const storage = memoryStorage();
    storage.setItem(store.key, "broken-json");
    assert.throws(() => store.read(storage), (error) => codedError(error, "INVALID_STORED_DATA"));
    assert.equal(storage.getItem(store.key), "broken-json");
  });

  test(`${store.name}: quota failure preserves all previous data and supports a later retry`, () => {
    const storage = memoryStorage();
    store.write(storage);
    storage.setItem("unrelated", "keep this data");
    const before = new Map(storage.values);
    const failure = new DOMException("full", "QuotaExceededError");
    assert.throws(() => store.write({ ...storage, setItem: () => { throw failure; } }),
      (error) => codedError(error, "STORAGE_FULL", failure));
    assert.deepEqual(storage.values, before);
    assert.doesNotThrow(() => store.write(storage));
  });

  test(`${store.name}: write permission errors are distinguishable from quota errors`, () => {
    const failure = new DOMException("blocked", "SecurityError");
    assert.throws(() => store.write({ getItem: () => null, setItem: () => { throw failure; } }),
      (error) => codedError(error, "STORAGE_ACCESS_DENIED", failure));
  });
}

test("unrecognized storage failures preserve their cause and distinguish reads from writes", () => {
  const failure = new Error("disk unavailable");
  assert.throws(() => createChatStore({ getItem: () => { throw failure; }, setItem: () => {} }).getState(),
    (error) => codedError(error, "STORAGE_READ_FAILED", failure));
  assert.throws(() => createChatStore({ getItem: () => null, setItem: () => { throw failure; } }).createConversation(),
    (error) => codedError(error, "STORAGE_WRITE_FAILED", failure));
});

test("validation and missing records have machine-readable codes", () => {
  const storage = memoryStorage();
  assert.throws(() => createChatStore(storage).appendMessage("missing", "user", " "),
    (error) => codedError(error, "VALIDATION_ERROR"));
  assert.throws(() => createChatStore(storage).appendMessage("missing", "user", "内容"),
    (error) => codedError(error, "NOT_FOUND"));
  assert.throws(() => createGoalStore(storage).upsert("planning", " "),
    (error) => codedError(error, "VALIDATION_ERROR"));
});
