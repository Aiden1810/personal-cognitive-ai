"use client";

import { errorState, type AppErrorCode } from "../errors.ts";
import { getBrowserStorage } from "../storage/browser.ts";

import { useSyncExternalStore } from "react";
import type {
  BehaviorPattern,
  DecisionCase,
  DecisionComparison,
  DecisionFeedback,
  DemoState,
  ImprovementGoal,
} from "../../types/domain.ts";
import { createDemoStore, STORAGE_KEY } from "./store.ts";

interface DataSnapshot {
  state: DemoState | null;
  ready: boolean;
  error: string | null;
  errorCode: AppErrorCode | null;
}
const initial: DataSnapshot = { state: null, ready: false, error: null, errorCode: null };
let snapshot = initial;
let initialized = false;
const listeners = new Set<() => void>();

function refresh(): void {
  initialized = true;
  try {
    snapshot = {
      state: createDemoStore(getBrowserStorage()).getState(),
      ready: true,
      error: null,
      errorCode: null,
    };
  } catch (error) {
    snapshot = {
      state: null,
      ready: true,
      ...errorState(error, "读取本地资料失败。"),
    };
  }
}

function publish(): void {
  listeners.forEach((listener) => listener());
}

function getSnapshot(): DataSnapshot {
  if (!initialized) refresh();
  return snapshot;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) {
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

function execute(
  change: (store: ReturnType<typeof createDemoStore>) => void,
): boolean {
  try {
    change(createDemoStore(getBrowserStorage()));
    refresh();
    publish();
    return true;
  } catch (error) {
    snapshot = {
      ...snapshot,
      ready: true,
      ...errorState(error, "保存失败。"),
    };
    publish();
    return false;
  }
}

export function useDemoData() {
  const data = useSyncExternalStore(subscribe, getSnapshot, () => initial);
  return { ...data, ...demoDataActions };
}

// The only browser storage entry; feature modules must not use localStorage directly.
export const demoDataActions = {
  saveCase: (record: DecisionCase) =>
    execute((store) => store.saveCase(record)),
  deleteCase: (id: string) => execute((store) => store.deleteCase(id)),
  savePattern: (record: BehaviorPattern) =>
    execute((store) => store.savePattern(record)),
  saveGoal: (record: ImprovementGoal) =>
    execute((store) => store.saveGoal(record)),
  saveComparison: (record: DecisionComparison) =>
    execute((store) => store.saveComparison(record)),
  saveFeedback: (record: DecisionFeedback) =>
    execute((store) => store.saveFeedback(record)),
  reset: () => execute((store) => store.reset()),
};

export function createRecordMetadata() {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    userId: "demo-user",
    createdAt: now,
    updatedAt: now,
  };
}
