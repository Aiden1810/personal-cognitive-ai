"use client";

import { errorState, type AppErrorCode } from "../errors.ts";
import { getBrowserStorage } from "../storage/browser.ts";

import { useSyncExternalStore } from "react";
import { ASSESSMENT_STORAGE_KEY, createAssessmentStore, type AssessmentLabel, type AssessmentState } from "./assessment";

interface Snapshot {
  state: AssessmentState | null;
  ready: boolean;
  error: string | null;
  errorCode: AppErrorCode | null;
}

const initial: Snapshot = { state: null, ready: false, error: null, errorCode: null };
let snapshot = initial;
let initialized = false;
const listeners = new Set<() => void>();

function publish() { listeners.forEach((listener) => listener()); }

function refresh() {
  initialized = true;
  try { snapshot = { state: createAssessmentStore(getBrowserStorage()).getState(), ready: true, error: null, errorCode: null }; }
  catch (error) { snapshot = { state: null, ready: true, ...errorState(error, "读取画像标记失败。") }; }
}

function getSnapshot() {
  if (!initialized) refresh();
  return snapshot;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === ASSESSMENT_STORAGE_KEY || event.key === null) { refresh(); publish(); }
  };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(listener); window.removeEventListener("storage", onStorage); };
}

function execute(action: (store: ReturnType<typeof createAssessmentStore>) => void): boolean {
  try {
    action(createAssessmentStore(getBrowserStorage()));
    refresh(); publish();
    return true;
  } catch (error) {
    snapshot = { ...snapshot, ready: true, ...errorState(error, "画像标记保存失败。") };
    publish();
    return false;
  }
}

export function useAssessmentData() {
  const data = useSyncExternalStore(subscribe, getSnapshot, () => initial);
  return {
    ...data,
    setLabel: (id: string, label: AssessmentLabel | null) => execute((store) => store.setLabel(id, label)),
    addTension: (firstId: string, secondId: string, note: string) =>
      execute((store) => { store.addTension(firstId, secondId, note); }),
    removeTension: (id: string) => execute((store) => store.removeTension(id)),
    resetAssessment: () => execute((store) => store.reset()),
  };
}
