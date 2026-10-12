import assert from "node:assert/strict";
import test from "node:test";
import { prepareLocalBackup, serializeLocalBackup } from "../src/lib/backup/local.ts";
import { createLocalSnapshot, restoreLocalSnapshot } from "../src/lib/cloud/snapshot.ts";
import { createChatStore, CHAT_STORAGE_KEY } from "../src/lib/chat/store.ts";
import { createGoalStore } from "../src/lib/goals/store.ts";
import { createAutoProfileStore } from "../src/lib/profile/auto.ts";

function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}

test("offline JSON export and import preserve conversations and independent user goals", () => {
  const source = memoryStorage();
  const chat = createChatStore(source);
  const conversation = chat.createConversation();
  chat.appendMessage(conversation.id, "user", "合成备份测试消息");
  createGoalStore(source).upsert("knowledge_structure", "合成目标：复习课程", "moderate");
  const text = serializeLocalBackup(createLocalSnapshot(source));
  const prepared = prepareLocalBackup(text);
  assert.deepEqual(prepared.summary, { conversations: 1, messages: 1, insights: 0, goals: 1, outcomes: 0 });
  const destination = memoryStorage();
  restoreLocalSnapshot(prepared.snapshot, destination);
  assert.equal(createChatStore(destination).getState().conversations[0].messages[0].content, "合成备份测试消息");
  assert.equal(createGoalStore(destination).getState().goals[0].willingness, "moderate");
});

test("invalid JSON and unsupported snapshot versions are rejected without writes", () => {
  const original = memoryStorage();
  original.setItem(CHAT_STORAGE_KEY, "untouched");
  assert.throws(() => prepareLocalBackup("not json"), /JSON/);
  assert.throws(() => prepareLocalBackup(JSON.stringify({ version: 2 })), /不兼容/);
  assert.equal(original.getItem(CHAT_STORAGE_KEY), "untouched");
});

test("the import limit counts UTF-8 bytes rather than JavaScript string length", () => {
  assert.throws(() => prepareLocalBackup("学".repeat(1_700_000)), /5 MB/);
});

test("restoring an older snapshot pauses automatic extraction rather than reusing the previous browser's opt-in", () => {
  const destination = memoryStorage();
  createAutoProfileStore(destination).setEnabled(true, []);
  restoreLocalSnapshot(createLocalSnapshot(memoryStorage()), destination);
  assert.deepEqual(createAutoProfileStore(destination).getState(), { version: 1, enabled: false, checkpoints: {} });
});
