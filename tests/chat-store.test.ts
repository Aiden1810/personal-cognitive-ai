import assert from "node:assert/strict";
import test from "node:test";
import { createChatStore, CHAT_STORAGE_KEY } from "../src/lib/chat/store.ts";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    raw: (key: string) => values.get(key),
  };
}

test("a conversation and its messages survive reopening the store", () => {
  const storage = memoryStorage();
  const store = createChatStore(storage);
  const conversation = store.createConversation();
  store.appendMessage(conversation.id, "user", "  今天想整理我的想法  ");
  const reopened = createChatStore(storage).getState();
  assert.equal(reopened.conversations.length, 1);
  assert.equal(
    reopened.conversations[0].messages[0].content,
    "今天想整理我的想法",
  );
  assert.equal(reopened.conversations[0].title, "今天想整理我的想法");
});

test("blank messages do not enter a conversation", () => {
  const storage = memoryStorage();
  const store = createChatStore(storage);
  const conversation = store.createConversation();
  assert.throws(
    () => store.appendMessage(conversation.id, "user", " \n "),
    /不能为空/,
  );
  assert.equal(store.getState().conversations[0].messages.length, 0);
});

test("malformed saved chats are reported and preserved", () => {
  const storage = memoryStorage();
  storage.setItem(CHAT_STORAGE_KEY, "broken-data");
  assert.throws(() => createChatStore(storage).getState(), /格式损坏/);
  assert.equal(storage.raw(CHAT_STORAGE_KEY), "broken-data");
});

test("deleting one conversation keeps the other conversation", () => {
  const storage = memoryStorage();
  const store = createChatStore(storage);
  const first = store.createConversation();
  const second = store.createConversation();
  store.appendMessage(second.id, "user", "保留这条");
  store.deleteConversation(first.id);
  assert.deepEqual(
    store.getState().conversations.map((item) => item.id),
    [second.id],
  );
  assert.equal(
    store.getState().conversations[0].messages[0].content,
    "保留这条",
  );
});

test("a message cannot be added to an unknown conversation", () => {
  const store = createChatStore(memoryStorage());
  assert.throws(() => store.appendMessage("missing", "user", "内容"), /不存在/);
});

test("damaged local chats are cleared only by an explicit reset", () => {
  const storage = memoryStorage();
  storage.setItem(CHAT_STORAGE_KEY, "broken-data");
  const store = createChatStore(storage);
  assert.throws(() => store.getState(), /格式损坏/);
  store.reset();
  assert.deepEqual(store.getState(), { version: 1, conversations: [] });
});
