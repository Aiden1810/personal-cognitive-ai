import test from "node:test";
import assert from "node:assert/strict";
import { createAutoProfileStore, shouldAutoExtract } from "../src/lib/profile/auto.ts";
import type { Conversation } from "../src/lib/chat/store.ts";

const conversation: Conversation = {
  id: "c1", title: "测试", createdAt: "2026-09-29T00:00:00Z", updatedAt: "2026-09-29T00:00:00Z",
  messages: Array.from({ length: 6 }, (_, index) => ({ id: `m${index}`, role: "user" as const, content: `消息${index}`, createdAt: "2026-09-29T00:00:00Z" })),
};

test("自动提取默认关闭，开启时以当时消息为起点，每四条新发言触发一次", () => {
  let value: string | null = null;
  const store = createAutoProfileStore({ getItem: () => value, setItem: (_key, next) => { value = next; } });
  assert.equal(store.getState().enabled, false);
  store.setEnabled(true, [{ ...conversation, messages: conversation.messages.slice(0, 2) }]);
  assert.equal(shouldAutoExtract({ ...conversation, messages: conversation.messages.slice(0, 5) }, store.getState()), false);
  assert.equal(shouldAutoExtract(conversation, store.getState()), true);
  store.markProcessed(conversation);
  assert.equal(shouldAutoExtract(conversation, store.getState()), false);
  store.setEnabled(false, []);
  assert.equal(shouldAutoExtract(conversation, store.getState()), false);
});

test("损坏的自动提取设置不会被覆盖", () => {
  let writes = 0;
  const store = createAutoProfileStore({ getItem: () => "{broken", setItem: () => { writes++; } });
  assert.throws(() => store.setEnabled(true, []), /格式损坏/);
  assert.equal(writes, 0);
});
