import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { CHAT_STORAGE_KEY, createChatStore } from "../src/lib/chat/store.ts";
import { createGoalStore, GOAL_STORAGE_KEY } from "../src/lib/goals/store.ts";
import { createProfileStore, PROFILE_STORAGE_KEY } from "../src/lib/profile/store.ts";
import { createOutcomeStore } from "../src/lib/outcomes/store.ts";
import type { ChatSuggestion } from "../src/lib/chat/suggestions.ts";

function setup(kind: ChatSuggestion["kind"] = "goal") {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  const chat = createChatStore(storage);
  const conversation = chat.createConversation();
  const oldMessage = chat.appendMessage(conversation.id, "user", "合成案例：晚上经常熬夜到1点");
  createProfileStore(storage).addCandidates([{ id: "i1", dimension: "behavioral_patterns", statement: "晚上经常熬夜到1点", origin: "user_statement", status: "candidate", evidence: [{ conversationId: conversation.id, messageId: oldMessage.id, excerpt: "晚上经常熬夜到1点" }] }]);
  createProfileStore(storage).confirm("i1");
  const goal = createGoalStore(storage).upsert("knowledge_structure", "每天先做20分钟复习题");
  const source = chat.appendMessage(conversation.id, "user", "合成案例：我想改掉拖延，现在已经习惯早起了，今天复习了一小时。");
  const reply = chat.appendMessage(conversation.id, "assistant", "合成建议：请核对后保存。");
  const base = { id: "a1", sourceMessageId: source.id, status: "pending" as const, reason: "合成建议", excerpt: "我想改掉拖延" };
  const action: ChatSuggestion = kind === "goal" ? { ...base, kind, dimension: "behavioral_patterns", intention: "每天早上列出3件最重要的事" } :
    kind === "archive" ? { ...base, kind, excerpt: "现在已经习惯早起了", insightId: "i1", insightStatement: "晚上经常熬夜到1点" } :
      { ...base, kind, excerpt: "今天复习了一小时", goalId: goal.id, goalIntention: goal.intention, action: "今天复习了一小时", result: "" };
  return { storage, values, chat, conversation, reply, source, action, goal };
}

async function actions() {
  assert.ok(existsSync(new URL("../src/lib/chat/actions.ts", import.meta.url)), "用户确认执行模块尚未实现");
  return import("../src/lib/chat/actions.ts");
}

test("confirmation uses edited goal text and repeated confirmation cannot save twice", async () => {
  const { applyChatSuggestion } = await actions();
  const { chat, storage, conversation, reply, action } = setup();
  chat.setSuggestions(conversation.id, reply.id, [action]);
  applyChatSuggestion(storage, conversation.id, reply.id, action.id, { kind: "goal", intention: "先专注25分钟", willingness: null, expectedGoal: null });
  assert.equal(createGoalStore(storage).getState().goals.find((item) => item.dimension === "behavioral_patterns")?.intention, "先专注25分钟");
  assert.equal(chat.getState().conversations[0].messages.at(-1)?.suggestions?.[0].status, "completed");
  assert.throws(() => applyChatSuggestion(storage, conversation.id, reply.id, action.id, { kind: "goal", intention: "重复目标", expectedGoal: null }), /已处理/);
});

test("goal suggestions save the user-selected target level and reject stale target-level edits", async () => {
  const { applyChatSuggestion } = await actions();
  const data = setup();
  if (data.action.kind !== "goal") throw new Error("Expected goal fixture");
  const action = { ...data.action, dimension: "planning" as const };
  data.chat.setSuggestions(data.conversation.id, data.reply.id, [action]);
  applyChatSuggestion(data.storage, data.conversation.id, data.reply.id, action.id, { kind: "goal", intention: "明确任务步骤", targetLevel: "high", expectedGoal: null });
  assert.equal(createGoalStore(data.storage).getState().goals.find((goal) => goal.dimension === "planning")?.targetLevel, "high");

  const second = setup();
  second.chat.setSuggestions(second.conversation.id, second.reply.id, [{ ...action, sourceMessageId: second.source.id }]);
  const goals = createGoalStore(second.storage);
  const expected = { ...goals.upsert("planning", "明确任务步骤", undefined, "medium") };
  goals.upsert("planning", "明确任务步骤", undefined, "low");
  assert.throws(() => applyChatSuggestion(second.storage, second.conversation.id, second.reply.id, action.id, { kind: "goal", intention: "新的步骤", targetLevel: "high", expectedGoal: expected }), /目标.*变化/);
});

test("dismissing a suggestion changes no target or profile data", () => {
  const { chat, storage, conversation, reply, action } = setup();
  assert.equal(typeof chat.setSuggestions, "function", "聊天记录尚不能保存建议");
  chat.setSuggestions(conversation.id, reply.id, [action]);
  const before = storage.getItem(GOAL_STORAGE_KEY);
  chat.setSuggestionStatus(conversation.id, reply.id, action.id, "dismissed");
  assert.equal(storage.getItem(GOAL_STORAGE_KEY), before);
});

test("changed or newly created goal cannot be silently overwritten", async () => {
  const { applyChatSuggestion } = await actions();
  const { chat, storage, conversation, reply, action } = setup();
  chat.setSuggestions(conversation.id, reply.id, [action]);
  createGoalStore(storage).upsert("behavioral_patterns", "用户在另一页新建的目标");
  assert.throws(() => applyChatSuggestion(storage, conversation.id, reply.id, action.id, { kind: "goal", intention: "建议目标", expectedGoal: null }), /目标.*变化/);
  assert.equal(createGoalStore(storage).getState().goals.find((item) => item.dimension === "behavioral_patterns")?.intention, "用户在另一页新建的目标");
});

test("archiving preserves old evidence and the newly reported change remains unconfirmed", async () => {
  const { applyChatSuggestion } = await actions();
  const { chat, storage, conversation, reply, action } = setup("archive");
  chat.setSuggestions(conversation.id, reply.id, [action]);
  const evidence = createProfileStore(storage).getState().insights[0].evidence;
  applyChatSuggestion(storage, conversation.id, reply.id, action.id, { kind: "archive" });
  const insights = createProfileStore(storage).getState().insights;
  assert.equal(insights.length, 1);
  assert.equal(insights[0].status, "archived");
  assert.deepEqual(insights[0].evidence, evidence);
});

test("edited memory and deleted goals invalidate old suggestions", async () => {
  const { applyChatSuggestion } = await actions();
  const archive = setup("archive");
  archive.chat.setSuggestions(archive.conversation.id, archive.reply.id, [archive.action]);
  createProfileStore(archive.storage).edit("i1", "用户改写过的记忆");
  assert.throws(() => applyChatSuggestion(archive.storage, archive.conversation.id, archive.reply.id, archive.action.id, { kind: "archive" }), /记忆.*变化/);
  const outcome = setup("outcome");
  outcome.chat.setSuggestions(outcome.conversation.id, outcome.reply.id, [outcome.action]);
  createGoalStore(outcome.storage).delete(outcome.goal.id);
  assert.throws(() => applyChatSuggestion(outcome.storage, outcome.conversation.id, outcome.reply.id, outcome.action.id, { kind: "outcome", action: "复习", result: "完成了", rating: "toward" }), /目标.*变化/);
});

test("outcome requires user result and stores the user's own assessment exactly once", async () => {
  const { applyChatSuggestion } = await actions();
  const { chat, storage, conversation, reply, action } = setup("outcome");
  chat.setSuggestions(conversation.id, reply.id, [action]);
  assert.throws(() => applyChatSuggestion(storage, conversation.id, reply.id, action.id, { kind: "outcome", action: "今天复习了一小时", result: "", rating: "unclear" }), /结果/);
  applyChatSuggestion(storage, conversation.id, reply.id, action.id, { kind: "outcome", action: "今天复习了一小时", result: "做完了两道题", rating: "toward" });
  assert.equal(createOutcomeStore(storage).getState().entries.length, 1);
  assert.equal(createOutcomeStore(storage).getState().entries[0].rating, "toward");
});

test("failure on the second storage write rolls back the business update and pending status", async () => {
  const { applyChatSuggestion } = await actions();
  const { chat, storage, conversation, reply, action, values } = setup();
  chat.setSuggestions(conversation.id, reply.id, [action]);
  const before = new Map(values);
  let writes = 0;
  const cause = new DOMException("full", "QuotaExceededError");
  const failing = { ...storage, setItem: (key: string, value: string) => {
    if (++writes === 2) throw cause;
    storage.setItem(key, value);
  } };
  assert.throws(() => applyChatSuggestion(failing, conversation.id, reply.id, action.id, { kind: "goal", intention: "建议目标", expectedGoal: null }), { code: "STORAGE_FULL", cause });
  assert.deepEqual(values, before);
});

test("forged suggestion sources and suggestions attached to user messages are rejected", () => {
  const { chat, storage, conversation, reply, source, action } = setup();
  assert.equal(typeof chat.setSuggestions, "function", "聊天记录尚不能保存建议");
  assert.throws(() => chat.setSuggestions(conversation.id, reply.id, [{ ...action, sourceMessageId: "missing" }]), /建议.*无效/);
  assert.throws(() => chat.setSuggestions(conversation.id, source.id, [action]), /助手/);
  const state = chat.getState();
  state.conversations[0].messages.at(-1)!.suggestions = [{ ...action, status: "auto_saved" } as unknown as ChatSuggestion];
  storage.setItem(CHAT_STORAGE_KEY, JSON.stringify(state));
  assert.throws(() => chat.getState(), /损坏/);
  assert.ok(storage.getItem(PROFILE_STORAGE_KEY));
});
