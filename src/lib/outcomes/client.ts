"use client";

import { errorState, type AppErrorCode } from "../errors.ts";
import { getBrowserStorage } from "../storage/browser.ts";

import { useSyncExternalStore } from "react";
import type { UserGoal } from "../../types/cognitive";
import { createOutcomeStore, OUTCOME_STORAGE_KEY, type OutcomeRating, type OutcomeState } from "./store";

interface Snapshot {
  state: OutcomeState | null;
  ready: boolean;
  error: string | null;
  errorCode: AppErrorCode | null;
}

const initial: Snapshot = { state: null, ready: false, error: null, errorCode: null };
let snapshot = initial;
let initialized = false;
const listeners = new Set<() => void>();

function publish() { listeners.forEach((listener) => listener()); }

export function refreshOutcomeData() { refresh(); publish(); }

function refresh() {
  initialized = true;
  try {
    snapshot = { state: createOutcomeStore(getBrowserStorage()).getState(), ready: true, error: null, errorCode: null };
  } catch (error) {
    const failure = errorState(error, "读取行动反馈失败。");
    snapshot = {
      state: failure.errorCode === "STORAGE_ACCESS_DENIED" || failure.errorCode === "STORAGE_READ_FAILED" ? snapshot.state : null,
      ready: true,
      ...failure,
    };
  }
}

function getSnapshot() {
  if (!initialized) refresh();
  return snapshot;
}

function subscribe(listener: () => void) {
  const wasUnsubscribed = listeners.size === 0;
  listeners.add(listener);
  // Storage events can be missed while the page is unmounted.
  if (wasUnsubscribed) { refresh(); publish(); }
  const onStorage = (event: StorageEvent) => {
    if (event.key === OUTCOME_STORAGE_KEY || event.key === null) { refresh(); publish(); }
  };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(listener); window.removeEventListener("storage", onStorage); };
}

function execute(action: (store: ReturnType<typeof createOutcomeStore>) => void): boolean {
  try {
    action(createOutcomeStore(getBrowserStorage()));
    refresh(); publish();
    return true;
  } catch (error) {
    snapshot = { ...snapshot, ready: true, ...errorState(error, "行动反馈保存失败。") };
    publish();
    return false;
  }
}

export function useOutcomeData() {
  const data = useSyncExternalStore(subscribe, getSnapshot, () => initial);
  return {
    ...data,
    retryLoad: refreshOutcomeData,
    add: (goal: UserGoal, action: string, result: string, rating: OutcomeRating) =>
      execute((store) => { store.add(goal, action, result, rating); }),
    deleteEntry: (id: string) => execute((store) => store.delete(id)),
    resetOutcomes: () => execute((store) => store.reset()),
  };
}
