"use client";

import { errorState, type AppErrorCode } from "../errors.ts";
import { getBrowserStorage } from "../storage/browser.ts";

import { useSyncExternalStore } from "react";
import { createGoalStore, GOAL_STORAGE_KEY } from "./store";
import type { GoalState } from "./store";
import type { CognitiveDimension, GoalWillingness, TraitLevel } from "../../types/cognitive";

interface Snapshot {
  state: GoalState | null;
  ready: boolean;
  error: string | null;
  errorCode: AppErrorCode | null;
}

const initial: Snapshot = { state: null, ready: false, error: null, errorCode: null };
let snapshot = initial;
let initialized = false;
const listeners = new Set<() => void>();

function publish() {
  listeners.forEach((listener) => listener());
}

export function refreshGoalData() { refresh(); publish(); }

function refresh() {
  initialized = true;
  try {
    snapshot = { state: createGoalStore(getBrowserStorage()).getState(), ready: true, error: null, errorCode: null };
  } catch (error) {
    snapshot = {
      state: null,
      ready: true,
      ...errorState(error, "读取本地目标失败。"),
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
    const result = action(createGoalStore(getBrowserStorage()));
    refresh();
    publish();
    return result;
  } catch (error) {
    snapshot = {
      ...snapshot,
      ready: true,
      ...errorState(error, "本地目标保存失败。"),
    };
    publish();
    return null;
  }
}

export function useGoalData() {
  const data = useSyncExternalStore(subscribe, getSnapshot, () => initial);
  return {
    ...data,
    upsert: (dimension: CognitiveDimension, intention: string, willingness?: GoalWillingness | null, targetLevel?: TraitLevel | null) =>
      execute((store) => store.upsert(dimension, intention, willingness, targetLevel)),
    pause: (id: string) => execute((store) => { store.pause(id); return true; }),
    resume: (id: string) => execute((store) => { store.resume(id); return true; }),
    deleteGoal: (id: string) => execute((store) => { store.delete(id); return true; }),
    resetGoals: () => execute((store) => { store.reset(); return true; }),
  };
}
