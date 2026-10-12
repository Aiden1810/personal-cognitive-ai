import assert from "node:assert/strict";
import test from "node:test";
import { createChatStore, CHAT_STORAGE_KEY } from "../src/lib/chat/store.ts";
import { createLocalSnapshot, restoreLocalSnapshot } from "../src/lib/cloud/snapshot.ts";
import { prepareLocalBackup, serializeLocalBackup } from "../src/lib/backup/local.ts";
import { createChatReferences, resolveChatReferences } from "../src/lib/chat/references.ts";
import type { ChatContextSelection } from "../src/lib/chat/context.ts";
import type { ProfileInsight, UserGoal } from "../src/types/cognitive.ts";
import type { Conversation } from "../src/lib/chat/store.ts";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

function emptyReferences(sourceMessageId: string) {
  return {
    version: 1 as const, sourceMessageId, requestedAt: "2026-10-12T02:00:00Z",
    querySource: "question" as const, retrievalMethod: "keyword" as const,
    insights: [], goals: [], omittedByBudget: 0,
    settings: { background: false, instructions: false, responsePreferences: false },
  };
}

test("each assistant reply retains its own reference record after reopening and JSON restore", () => {
  const storage = memoryStorage();
  const store = createChatStore(storage);
  const conversation = store.createConversation();
  const first = store.appendMessage(conversation.id, "user", "合成问题一");
  const firstReferences = emptyReferences(first.id);
  store.appendMessage(conversation.id, "assistant", "合成回复一", firstReferences);
  const second = store.appendMessage(conversation.id, "user", "合成问题二");
  const secondReferences = { ...emptyReferences(second.id), settings: { background: true, instructions: false, responsePreferences: false } };
  store.appendMessage(conversation.id, "assistant", "合成回复二", secondReferences);
  const reopened = createChatStore(storage).getState().conversations[0].messages;
  assert.deepEqual(reopened[1].references, firstReferences);
  assert.deepEqual(reopened[3].references, secondReferences);
  const destination = memoryStorage();
  restoreLocalSnapshot(prepareLocalBackup(serializeLocalBackup(createLocalSnapshot(storage))).snapshot, destination);
  assert.deepEqual(createChatStore(destination).getState().conversations[0].messages, reopened);
});

test("reference records cannot be attached to a user message or an unrelated question", () => {
  const storage = memoryStorage();
  const store = createChatStore(storage);
  const conversation = store.createConversation();
  const question = store.appendMessage(conversation.id, "user", "合成提问");
  const before = storage.getItem(CHAT_STORAGE_KEY);
  assert.throws(() => store.appendMessage(conversation.id, "user", "另一条用户发言", emptyReferences(question.id)), /参考/);
  assert.throws(() => store.appendMessage(conversation.id, "assistant", "合成回复", emptyReferences("unrelated")), /参考/);
  assert.equal(storage.getItem(CHAT_STORAGE_KEY), before);
});

test("malformed persisted references are reported without discarding the original chat", () => {
  const storage = memoryStorage();
  const store = createChatStore(storage);
  const conversation = store.createConversation();
  const question = store.appendMessage(conversation.id, "user", "合成提问");
  store.appendMessage(conversation.id, "assistant", "合成回复");
  const state = store.getState();
  Object.assign(state.conversations[0].messages[1], { references: { ...emptyReferences(question.id), requestedAt: "invalid" } });
  const raw = JSON.stringify(state);
  storage.setItem(CHAT_STORAGE_KEY, raw);
  assert.throws(() => store.getState(), /格式损坏/);
  assert.equal(storage.getItem(CHAT_STORAGE_KEY), raw);
});

test("old replies remain readable without inventing a reference record", () => {
  const storage = memoryStorage();
  const store = createChatStore(storage);
  const conversation = store.createConversation();
  store.appendMessage(conversation.id, "user", "合成旧问题");
  store.appendMessage(conversation.id, "assistant", "合成旧回复");
  const prepared = prepareLocalBackup(serializeLocalBackup(createLocalSnapshot(storage)));
  assert.equal(prepared.snapshot.chat.conversations[0].messages[1].references, undefined);
});

test("a failed combined reply and reference write preserves the saved question", () => {
  const storage = memoryStorage();
  const store = createChatStore(storage);
  const conversation = store.createConversation();
  const question = store.appendMessage(conversation.id, "user", "合成提问");
  const before = storage.getItem(CHAT_STORAGE_KEY);
  const blocked = createChatStore({ ...storage, setItem: () => { throw new DOMException("full", "QuotaExceededError"); } });
  assert.throws(() => blocked.appendMessage(conversation.id, "assistant", "合成回复", emptyReferences(question.id)), /保存失败/);
  assert.equal(storage.getItem(CHAT_STORAGE_KEY), before);
});

const profile: ProfileInsight = {
  id: "synthetic-study", dimension: "planning", statement: "合成记忆：复习时先做题", origin: "user_statement", status: "confirmed", scope: "preference",
  evidence: [{ conversationId: "sources", messageId: "source-message", excerpt: "合成原话：复习时先做题" }],
};
const goal: UserGoal = { id: "synthetic-goal", dimension: "planning", intention: "合成目标：先完成一道题", status: "active" };
const sources: Conversation[] = [{ id: "sources", title: "合成来源", createdAt: "2026-10-12T00:00:00Z", updatedAt: "2026-10-12T00:00:00Z", messages: [{ id: "source-message", role: "user", content: "合成原话：复习时先做题", createdAt: "2026-10-12T00:00:00Z" }] }];
const selection: ChatContextSelection = {
  insights: [profile], goals: [goal], querySource: "question", characters: 300, omittedByBudget: 0,
  reasons: [{ kind: "insight", id: profile.id, terms: ["复习"], topics: ["学习"] }],
  personalContext: { enabled: true, background: "合成私密背景", instructions: "合成回答要求", updatedAt: "2026-10-12T00:00:00Z" },
};

test("saved references retain selection and settings flags without duplicating personal text", () => {
  const references = createChatReferences(selection, "question");
  const raw = JSON.stringify(references);
  for (const privateText of [profile.statement, profile.evidence[0].excerpt, goal.intention, "合成私密背景", "合成回答要求"]) assert.ok(!raw.includes(privateText));
  const resolved = resolveChatReferences(references, [profile], [goal], sources);
  assert.equal(resolved.selection.insights[0].id, "synthetic-study");
  assert.equal(resolved.selection.goals[0].id, "synthetic-goal");
  assert.deepEqual(resolved.selection.reasons[0].topics, ["学习"]);
  assert.deepEqual(references.settings, { background: true, instructions: true, responsePreferences: false });
  assert.equal(resolved.unavailableCount, 0);
});

test("editing or deleting a referenced record does not display its old or replacement text", () => {
  const references = createChatReferences(selection, "question");
  for (const current of [[], [{ ...profile, statement: "合成替换内容" }], [{ ...profile, status: "candidate" as const }], [{ ...profile, status: "archived" as const }]]) {
    const resolved = resolveChatReferences(references, current, [], sources);
    assert.deepEqual(resolved.selection.insights, []);
    assert.deepEqual(resolved.selection.goals, []);
    assert.equal(resolved.unavailableCount, 2);
  }
});

test("removing source evidence or pausing a target makes historical references unavailable", () => {
  const references = createChatReferences(selection, "question");
  const resolved = resolveChatReferences(references, [profile], [{ ...goal, status: "paused" }], []);
  assert.deepEqual(resolved.selection.insights, []);
  assert.deepEqual(resolved.selection.goals, []);
  assert.equal(resolved.unavailableCount, 2);
});

test("historical panels retain only the evidence actually selected for that request", () => {
  const references = createChatReferences(selection, "question");
  const current = { ...profile, evidence: [...profile.evidence, { conversationId: "sources", messageId: "extra", excerpt: "另一条合成原话" }] };
  const expandedSources = [{ ...sources[0], messages: [...sources[0].messages, { id: "extra", role: "user" as const, content: "另一条合成原话", createdAt: sources[0].createdAt }] }];
  const resolved = resolveChatReferences(references, [current], [goal], expandedSources);
  assert.deepEqual(resolved.selection.insights[0].evidence, profile.evidence);
});

test("zero selected memories stay distinct from legacy replies without a record", () => {
  const references = createChatReferences({ ...selection, insights: [], goals: [], reasons: [] }, "question");
  const resolved = resolveChatReferences(references, [profile], [goal], sources);
  assert.deepEqual(resolved.selection.insights, []);
  assert.deepEqual(resolved.selection.goals, []);
  assert.equal(resolved.unavailableCount, 0);
});

test("a pure semantic match keeps its matching explanation after persistence", () => {
  const references = createChatReferences({ ...selection, retrieval: { method: "hybrid" },
    reasons: [{ kind: "insight", id: profile.id, terms: [], topics: [], semanticSimilarity: 0.8 }] }, "question");
  const reopened = JSON.parse(JSON.stringify(references));
  const resolved = resolveChatReferences(reopened, [profile], [goal], sources);
  assert.equal(resolved.selection.reasons[0].semanticMatched, true);
});
