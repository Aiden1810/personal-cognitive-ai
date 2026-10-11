import test from "node:test";
import assert from "node:assert/strict";
import { createLocalSnapshot, parseCloudSnapshot, restoreLocalSnapshot } from "../src/lib/cloud/snapshot.ts";
import { CHAT_STORAGE_KEY, createChatStore } from "../src/lib/chat/store.ts";
import { GOAL_STORAGE_KEY, createGoalStore } from "../src/lib/goals/store.ts";
import { PROFILE_STORAGE_KEY } from "../src/lib/profile/store.ts";
import { AUTO_PROFILE_STORAGE_KEY, createAutoProfileStore } from "../src/lib/profile/auto.ts";

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

test("本地资料可生成并校验完整云端备份", () => {
  const source = storage();
  const conversation = createChatStore(source).createConversation();
  createChatStore(source).appendMessage(conversation.id, "user", "虚构消息");
  createGoalStore(source).upsert("behavioral_patterns", "虚构目标", "moderate");
  const snapshot = createLocalSnapshot(source);
  assert.equal(parseCloudSnapshot(snapshot).chat.conversations[0].messages[0].content, "虚构消息");
  const destination = storage();
  restoreLocalSnapshot(snapshot, destination);
  assert.equal(createChatStore(destination).getState().conversations.length, 1);
  assert.equal(createGoalStore(destination).getState().goals[0].willingness, "moderate");
});

test("损坏的备份不会覆盖浏览器资料", () => {
  const target = storage();
  target.setItem(CHAT_STORAGE_KEY, "original");
  assert.throws(() => restoreLocalSnapshot({ version: 1, chat: {} }, target), /损坏/);
  assert.equal(target.getItem(CHAT_STORAGE_KEY), "original");
});

test("恢复中途写入失败时回滚已经改动的本地资料", () => {
  const source = storage();
  const snapshot = createLocalSnapshot(source);
  const original = storage();
  original.setItem(CHAT_STORAGE_KEY, "old-chat");
  let failed = false;
  const unstable = {
    getItem: original.getItem,
    removeItem: original.removeItem,
    setItem(key: string, value: string) {
      original.setItem(key, value);
      if (!failed && key !== CHAT_STORAGE_KEY) {
        failed = true;
        throw new Error("simulated write failure");
      }
    },
  };
  assert.throws(() => restoreLocalSnapshot(snapshot, unstable), /已恢复原有本地资料/);
  assert.equal(original.getItem(CHAT_STORAGE_KEY), "old-chat");
});

test("恢复备份会关闭自动画像提取，并清除旧检查点", () => {
  const target = storage();
  createAutoProfileStore(target).setEnabled(true, []);
  restoreLocalSnapshot(createLocalSnapshot(storage()), target);
  assert.deepEqual(createAutoProfileStore(target).getState(), { version: 1, enabled: false, checkpoints: {} });
});

test("关闭自动提取写入失败也会回滚全部恢复内容", () => {
  const target = storage();
  target.setItem(CHAT_STORAGE_KEY, "original-chat");
  const previousAuto = JSON.stringify({ version: 1, enabled: true, checkpoints: {} });
  target.setItem(AUTO_PROFILE_STORAGE_KEY, previousAuto);
  let failed = false;
  const unstable = { ...target, setItem(key: string, value: string) {
    target.setItem(key, value);
    if (key === AUTO_PROFILE_STORAGE_KEY && !failed) { failed = true; throw new Error("write failure"); }
  } };
  assert.throws(() => restoreLocalSnapshot(createLocalSnapshot(storage()), unstable), /已恢复原有本地资料/);
  assert.equal(target.getItem(CHAT_STORAGE_KEY), "original-chat");
  assert.equal(target.getItem(AUTO_PROFILE_STORAGE_KEY), previousAuto);
});

test("容量不足时按反向写入路径回滚，不让大旧对话和大新画像同时占用空间", () => {
  const values = new Map<string, string>();
  const capacity = 2500;
  const limited = {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => { values.delete(key); },
    setItem(key: string, value: string) {
      const otherLength = [...values].filter(([existing]) => existing !== key).reduce((total, [, existing]) => total + existing.length, 0);
      if (otherLength + value.length > capacity) throw new Error("QuotaExceededError");
      values.set(key, value);
    },
  };
  limited.setItem(CHAT_STORAGE_KEY, "c".repeat(1800));
  limited.setItem(PROFILE_STORAGE_KEY, "p".repeat(200));
  limited.setItem(GOAL_STORAGE_KEY, "g".repeat(100));
  const original = new Map(values);
  const snapshot = createLocalSnapshot(storage());
  snapshot.profile.insights = Array.from({ length: 2 }, (_, index) => ({ id: `i${index}`, dimension: "behavioral_patterns", statement: "复".repeat(450), status: "confirmed", origin: "user_statement", evidence: [{ conversationId: "c1", messageId: `m${index}`, excerpt: "学".repeat(450) }] }));
  snapshot.goals.goals = [{ id: "g1", dimension: "knowledge_structure", intention: "题".repeat(500), status: "active" }];
  assert.throws(() => restoreLocalSnapshot(snapshot, limited), /已恢复原有本地资料/);
  assert.deepEqual(values, original);
});

test("backup restore preserves the quota error code after a successful rollback", () => {
  const target = storage();
  createChatStore(target).createConversation();
  const before = createLocalSnapshot(target);
  const cause = new DOMException("full", "QuotaExceededError");
  let failed = false;
  const limited = { ...target, setItem(key: string, value: string) {
    if (!failed && key === PROFILE_STORAGE_KEY) { failed = true; throw cause; }
    target.setItem(key, value);
  } };
  assert.throws(() => restoreLocalSnapshot(createLocalSnapshot(storage()), limited),
    { code: "STORAGE_FULL", cause });
  assert.deepEqual(createLocalSnapshot(target), before);
});

test("backup rollback failure keeps both causes and requires manual recovery", () => {
  const target = storage();
  createChatStore(target).createConversation();
  const writeFailure = new DOMException("full", "QuotaExceededError");
  const rollbackFailure = new DOMException("blocked", "SecurityError");
  let attempts = 0;
  const limited = { ...target, setItem() { throw ++attempts === 1 ? writeFailure : rollbackFailure; } };
  assert.throws(() => restoreLocalSnapshot(createLocalSnapshot(storage()), limited), (error) => {
    assert.ok(error instanceof Error);
    assert.equal((error as Error & { code: string }).code, "ROLLBACK_FAILED");
    assert.ok(error.cause instanceof AggregateError);
    assert.deepEqual(error.cause.errors, [writeFailure, rollbackFailure]);
    return true;
  });
});
