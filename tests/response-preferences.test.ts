import assert from "node:assert/strict";
import test from "node:test";
import { createResponsePreferenceStore, RESPONSE_PREFERENCES_STORAGE_KEY } from "../src/lib/preferences/store.ts";

import { selectChatContext, serializeChatContext } from "../src/lib/chat/context.ts";
import { parseChatRequest } from "../src/lib/ai/chat.ts";
import type { ProfileInsight } from "../src/types/cognitive.ts";

function storage() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
}
const preferences = { length: "brief", explanation: "plain", structure: "conclusion_steps" } as const;

test("response preferences survive opening a new store and corrupt settings are not silently reset", () => {
  const target = storage();
  createResponsePreferenceStore(target).save(preferences);
  assert.deepEqual(createResponsePreferenceStore(target).getState().preferences, preferences);
  target.setItem(RESPONSE_PREFERENCES_STORAGE_KEY, "broken");
  assert.throws(() => createResponsePreferenceStore(target).getState(), /格式损坏/);
  assert.equal(target.getItem(RESPONSE_PREFERENCES_STORAGE_KEY), "broken");
});

test("an invalid setting or failed storage write does not replace saved preferences", () => {
  const target = storage();
  const store = createResponsePreferenceStore(target); store.save(preferences);
  const before = target.getItem(RESPONSE_PREFERENCES_STORAGE_KEY);
  assert.throws(() => store.save({ ...preferences, length: "__proto__" } as never), /无效/);
  assert.throws(() => createResponsePreferenceStore({ ...target, setItem: () => { throw new Error("quota"); } }).save({ ...preferences, length: "detailed" }), /保存失败/);
  assert.equal(target.getItem(RESPONSE_PREFERENCES_STORAGE_KEY), before);
});

test("the context budget includes scope and response preferences before the request reaches the model", () => {
  const records: ProfileInsight[] = Array.from({ length: 8 }, (_, index) => ({ id: `i${index}`, dimension: "behavioral_patterns", statement: `复习数学时先做题${index}`, status: "confirmed", origin: "ai_inference", scope: "pattern", evidence: [1, 2].map((number) => ({ conversationId: "c1", messageId: `${index}-${number}`, excerpt: "复习数学时先做题".repeat(45) })) }));
  const messages = [{ role: "user" as const, content: "如何复习数学？" }];
  const selected = selectChatContext(messages, records, [], preferences);
  assert.ok(selected.insights.length > 0 && selected.insights.length < 5);
  assert.ok(selected.characters <= 3000);
  assert.equal(selected.characters, serializeChatContext(selected.insights, selected.goals, selected.preferences).length);
  assert.doesNotThrow(() => parseChatRequest({ messages, insights: selected.insights, goals: [], preferences }));
});
