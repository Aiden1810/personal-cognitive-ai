"use client";

import { errorState, type AppErrorCode } from "../errors.ts";
import { getBrowserStorage } from "../storage/browser.ts";

import { useSyncExternalStore } from "react";
import { createResponsePreferenceStore, RESPONSE_PREFERENCES_STORAGE_KEY, type ResponsePreferenceState, type ResponsePreferences, type PersonalContextInput } from "./store";

interface Snapshot { state: ResponsePreferenceState | null; ready: boolean; error: string | null; errorCode: AppErrorCode | null; }
const initial: Snapshot = { state: null, ready: false, error: null, errorCode: null };
let snapshot = initial;
let initialized = false;
const listeners = new Set<() => void>();
function publish() { listeners.forEach((listener) => listener()); }
function refresh() {
  initialized = true;
  try { snapshot = { state: createResponsePreferenceStore(getBrowserStorage()).getState(), ready: true, error: null, errorCode: null }; }
  catch (error) {
    const failure = errorState(error, "回答偏好读取失败。");
    snapshot = { state: failure.errorCode === "STORAGE_ACCESS_DENIED" || failure.errorCode === "STORAGE_READ_FAILED" ? snapshot.state : null, ready: true, ...failure };
  }
}
function getSnapshot() { if (!initialized) refresh(); return snapshot; }
function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab may have written settings while this page was unmounted.
  refresh(); publish();
  function onStorage(event: StorageEvent) {
    if (event.key === RESPONSE_PREFERENCES_STORAGE_KEY || event.key === null) { refresh(); publish(); }
  }
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(listener); window.removeEventListener("storage", onStorage); };
}
function execute(action: (store: ReturnType<typeof createResponsePreferenceStore>) => void) {
    try {
      action(createResponsePreferenceStore(getBrowserStorage()));
      refresh(); publish(); return true;
    } catch (error) {
      snapshot = { ...snapshot, ...errorState(error, "回答偏好保存失败。") };
      publish(); return false;
    }
}
export function useResponsePreferences() {
  const data = useSyncExternalStore(subscribe, getSnapshot, () => initial);
  return { ...data,
    retryLoad: () => { refresh(); publish(); },
    save: (preferences: ResponsePreferences) => execute((store) => store.save(preferences)),
    savePersonalContext: (input: PersonalContextInput) => execute((store) => store.savePersonalContext(input)),
    clearPersonalContext: () => execute((store) => store.clearPersonalContext()),
  };
}
