import assert from "node:assert/strict";
import test from "node:test";
import type { Conversation } from "../src/lib/chat/store.ts";
import type { AutoProfileState } from "../src/lib/profile/auto.ts";
import * as auto from "../src/lib/profile/auto.ts";

const source: Conversation = {
  id: "synthetic", title: "合成验收", createdAt: "2026-10-12T00:00:00Z", updatedAt: "2026-10-12T00:00:00Z",
  messages: Array.from({ length: 4 }, (_, index) => ({ id: `m${index + 1}`, role: "user" as const, content: `合成发言${index + 1}`, createdAt: "2026-10-12T00:00:00Z" })),
};
const settings: AutoProfileState = { version: 1, enabled: true, checkpoints: {} };

function check(latest: Conversation | null, currentSettings: AutoProfileState) {
  const guard = (auto as Record<string, unknown>).canCommitAutoExtraction;
  assert.equal(typeof guard, "function", "automatic extraction must validate its source and checkpoint before saving");
  return (guard as (source: Conversation, before: AutoProfileState, latest: Conversation | null, after: AutoProfileState) => boolean)(source, settings, latest, currentSettings);
}

test("a pending automatic extraction cannot overwrite a newer checkpoint from another tab", () => {
  const latest = { ...source, messages: [...source.messages, { ...source.messages[0], id: "m8", content: "合成的新发言" }] };
  assert.equal(check(latest, { ...settings, checkpoints: { synthetic: "m8" } }), false);
});

test("deleting or changing sources, or disabling automatic extraction, discards its pending result", () => {
  assert.equal(check(null, settings), false);
  assert.equal(check({ ...source, messages: source.messages.slice(1) }, settings), false);
  assert.equal(check({ ...source, messages: source.messages.map((message, index) => index === 0 ? { ...message, content: "已修改" } : message) }, settings), false);
  assert.equal(check(source, { ...settings, enabled: false }), false);
});

test("new messages may arrive without moving the completed checkpoint beyond the analyzed source", () => {
  const latest = { ...source, messages: [...source.messages, { ...source.messages[0], id: "m5", content: "合成的新发言" }] };
  assert.equal(check(latest, settings), true);
});
