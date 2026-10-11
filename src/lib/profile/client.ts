"use client";

import { errorState, type AppErrorCode } from "../errors.ts";
import { getBrowserStorage } from "../storage/browser.ts";

import { useSyncExternalStore } from "react";
import { createProfileStore, PROFILE_STORAGE_KEY } from "./store";
import type { ProfileState } from "./store";
import type { ProfileInsight } from "../../types/cognitive";

interface Snapshot {
  state: ProfileState | null;
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

function refresh() {
  initialized = true;
  try {
    snapshot = {
      state: createProfileStore(getBrowserStorage()).getState(),
      ready: true,
      error: null, errorCode: null,
    };
  } catch (error) {
    snapshot = {
      state: null,
      ready: true,
      ...errorState(error, "读取本地画像失败。"),
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
    if (event.key === PROFILE_STORAGE_KEY || event.key === null) {
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

function execute<T>(action: (store: ReturnType<typeof createProfileStore>) => T): T | null {
  try {
    const result = action(createProfileStore(getBrowserStorage()));
    refresh();
    publish();
    return result;
  } catch (error) {
    snapshot = {
      ...snapshot,
      ready: true,
      ...errorState(error, "本地画像保存失败。"),
    };
    publish();
    return null;
  }
}

export function useProfileData() {
  const data = useSyncExternalStore(subscribe, getSnapshot, () => initial);
  return {
    ...data,
    addCandidates: (items: ProfileInsight[]) => execute((store) => store.addCandidates(items)),
    confirm: (id: string) => execute((store) => { store.confirm(id); return true; }),
    reject: (id: string) => execute((store) => { store.reject(id); return true; }),
    edit: (id: string, statement: string) => execute((store) => {
      store.edit(id, statement);
      return true;
    }),
    deleteInsight: (id: string) => execute((store) => { store.delete(id); return true; }),
    removeByConversation: (id: string) => execute((store) => {
      store.removeByConversation(id);
      return true;
    }),
    resetProfile: () => execute((store) => { store.reset(); return true; }),
  };
}
