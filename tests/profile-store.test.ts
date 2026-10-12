import assert from "node:assert/strict";
import test from "node:test";
import { createProfileStore, PROFILE_STORAGE_KEY } from "../src/lib/profile/store.ts";
import type { ProfileInsight } from "../src/types/cognitive.ts";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    raw: (key: string) => values.get(key),
  };
}

const candidate: ProfileInsight = {
  id: "insight-1",
  dimension: "behavioral_patterns",
  statement: "截止前常想增加新功能",
  origin: "ai_inference",
  status: "candidate",
  evidence: [{ conversationId: "c1", messageId: "m1", excerpt: "还有五天，我又想加功能" }],
};

test("candidate stays pending until the user confirms it", () => {
  const storage = memoryStorage();
  const store = createProfileStore(storage);
  store.addCandidates([candidate]);
  assert.equal(store.getConfirmedInsights().length, 0);
  store.confirm("insight-1");
  assert.equal(createProfileStore(storage).getConfirmedInsights()[0].statement, candidate.statement);
});

test("editing an accepted insight requires fresh confirmation", () => {
  const store = createProfileStore(memoryStorage());
  store.addCandidates([candidate]);
  store.confirm("insight-1");
  store.edit("insight-1", "有时在截止前想增加功能");
  assert.equal(store.getState().insights[0].status, "candidate");
  assert.equal(store.getConfirmedInsights().length, 0);
});

test("rejection and deletion remove insights from future personalization", () => {
  const store = createProfileStore(memoryStorage());
  store.addCandidates([candidate]);
  store.confirm("insight-1");
  store.reject("insight-1");
  assert.equal(store.getConfirmedInsights().length, 0);
  store.delete("insight-1");
  assert.equal(store.getState().insights.length, 0);
});

test("repeated extraction does not duplicate an already reviewed insight", () => {
  const store = createProfileStore(memoryStorage());
  store.addCandidates([candidate]);
  store.confirm("insight-1");
  store.addCandidates([{ ...candidate, id: "insight-2" }]);
  assert.equal(store.getState().insights.length, 1);
  assert.equal(store.getState().insights[0].status, "confirmed");
});

test("deleting a conversation removes insights sourced from it", () => {
  const store = createProfileStore(memoryStorage());
  store.addCandidates([candidate]);
  store.confirm("insight-1");
  store.removeByConversation("c1");
  assert.equal(store.getState().insights.length, 0);
});

test("corrupt profile data is reported without being overwritten", () => {
  const storage = memoryStorage();
  storage.setItem(PROFILE_STORAGE_KEY, "broken");
  const store = createProfileStore(storage);
  assert.throws(() => store.getState(), /格式损坏/);
  assert.equal(storage.raw(PROFILE_STORAGE_KEY), "broken");
});

test("punctuation variants cannot reintroduce a rejected assertion from the same message", () => {
  const store = createProfileStore(memoryStorage());
  store.addCandidates([candidate]);
  store.reject(candidate.id);
  assert.equal(store.addCandidates([{ ...candidate, id: "repeat", statement: `${candidate.statement}。`, evidence: [{ ...candidate.evidence[0], excerpt: "我又想加功能" }] }]), 0);
  assert.equal(store.getState().insights[0].status, "rejected");
  assert.equal(store.addCandidates([{ ...candidate, id: "different", statement: "截止前不想增加新功能" }]), 1);
});
