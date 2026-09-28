"use client";

import { useSyncExternalStore } from "react";
import { createGoalStore, GOAL_STORAGE_KEY } from "./store";
import type { GoalState } from "./store";
import type { CognitiveDimension } from "../../types/cognitive";

interface Snapshot {
  state: GoalState | null;
  ready: boolean;
  error: string | null;
}

const initial: Snapshot = { state: null, ready: false, error: null };
let snapshot = initial;
let initialized = false;
const listeners = new Set<() => void>();

function publish() {
  listeners.forEach((listener) => listener());
}

function refresh() {
  initialized = true;
  try {
    snapshot = { state: createGoalStore(window.localStorage).getState(), ready: true, error: null };
  } catch (error) {
    snapshot = {
      state: null,
      ready: true,
      error: error instanceof Error ? error.message : "读取本地目标失败。",
    };
  }
}

function getSnapshot() {
  if (!initialized) refresh();
  return snapshot;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === GOAL_STORAGE_KEY || event.key === null) {
      refresh();
      publish();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function execute<T>(action: (store: ReturnType<typeof createGoalStore>) => T): T | null {
  try {
    const result = action(createGoalStore(window.localStorage));
    refresh();
    publish();
    return result;
  } catch (error) {
    snapshot = {
      ...snapshot,
      ready: true,
      error: error instanceof Error ? error.message : "本地目标保存失败。",
    };
    publish();
    return null;
  }
}

export function useGoalData() {
  const data = useSyncExternalStore(subscribe, getSnapshot, () => initial);
  return {
    ...data,
    upsert: (dimension: CognitiveDimension, intention: string) =>
      execute((store) => store.upsert(dimension, intention)),
    pause: (id: string) => execute((store) => { store.pause(id); return true; }),
    resume: (id: string) => execute((store) => { store.resume(id); return true; }),
    deleteGoal: (id: string) => execute((store) => { store.delete(id); return true; }),
    resetGoals: () => execute((store) => { store.reset(); return true; }),
  };
}
