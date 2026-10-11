"use client";

import { errorState, type AppErrorCode } from "../errors.ts";
import { getBrowserStorage } from "../storage/browser.ts";

import { useSyncExternalStore } from "react";
import type { Conversation } from "../chat/store";
import { AUTO_PROFILE_STORAGE_KEY, createAutoProfileStore, type AutoProfileState } from "./auto";

interface Snapshot { state: AutoProfileState | null; ready: boolean; error: string | null; errorCode: AppErrorCode | null }
const initial: Snapshot = { state: null, ready: false, error: null, errorCode: null };
let snapshot = initial;
let initialized = false;
const listeners = new Set<() => void>();
function publish() { listeners.forEach((listener) => listener()); }
function refresh() {
  initialized = true;
  try { snapshot = { state: createAutoProfileStore(getBrowserStorage()).getState(), ready: true, error: null, errorCode: null }; }
  catch (error) { snapshot = { state: null, ready: true, ...errorState(error, "自动提取设置读取失败。") }; }
}
function getSnapshot() { if (!initialized) refresh(); return snapshot; }
function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => { if (event.key === AUTO_PROFILE_STORAGE_KEY || event.key === null) { refresh(); publish(); } };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(listener); window.removeEventListener("storage", onStorage); };
}
function execute(action: (store: ReturnType<typeof createAutoProfileStore>) => void): boolean {
  try { action(createAutoProfileStore(getBrowserStorage())); refresh(); publish(); return true; }
  catch (error) {
    snapshot = { ...snapshot, ready: true, ...errorState(error, "自动提取设置保存失败。") };
    publish(); return false;
  }
}
export function useAutoProfileData() {
  const data = useSyncExternalStore(subscribe, getSnapshot, () => initial);
  return {
    ...data,
    setEnabled: (enabled: boolean, conversations: Conversation[]) => execute((store) => store.setEnabled(enabled, conversations)),
    markProcessed: (conversation: Conversation) => execute((store) => store.markProcessed(conversation)),
    forgetConversation: (id: string) => execute((store) => store.forgetConversation(id)),
    resetCheckpoints: () => execute((store) => store.resetCheckpoints()),
  };
}

export function getSavedAutoProfileState(): AutoProfileState {
  return createAutoProfileStore(getBrowserStorage()).getState();
}
