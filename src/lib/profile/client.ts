"use client";

import { AppError, errorState, type AppErrorCode } from "../errors.ts";
import { getBrowserStorage } from "../storage/browser.ts";

import { useSyncExternalStore } from "react";
import { createProfileStore, PROFILE_STORAGE_KEY } from "./store";
import type { ProfileState } from "./store";
import type { ProfileInsight, ProfileScope, ResponseAdaptation, TraitLevel } from "../../types/cognitive";
import { createChatStore } from "../chat/store.ts";
import { hasIntactProfileEvidence } from "./usable.ts";

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

export function refreshProfileData() { refresh(); publish(); }

function refresh() {
  initialized = true;
  try {
    snapshot = {
      state: createProfileStore(getBrowserStorage()).getState(),
      ready: true,
      error: null,
      errorCode: null,
    };
  } catch (error) {
    const failure = errorState(error, "读取本地画像失败。");
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
  listeners.add(listener);
  // Refresh on remount; storage events can be missed while there are no subscribers.
  refresh();
  publish();
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
    retryLoad: refreshProfileData,
    skipQuestionnaire: () => execute((store) => { store.skipQuestionnaire(); return true; }),
    completeQuestionnaire: (items: ProfileInsight[]) => execute((store) => { store.completeQuestionnaire(items); return true; }),
    setCurrentLevel: (id: string, level: TraitLevel) => execute((store) => { store.setCurrentLevel(id, level); return true; }),
    addCandidates: (items: ProfileInsight[]) => execute((store) => {
      // Recheck current storage: the source may have been deleted while AI was responding.
      let conversations;
      try {
        conversations = createChatStore(getBrowserStorage()).getState().conversations;
      } catch (cause) {
        if (cause instanceof AppError && cause.code === "INVALID_STORED_DATA") {
          throw new AppError("CONFLICT", "原对话资料损坏，无法核对来源。请先检查对话或恢复备份；画像资料未改变。", { cause });
        }
        throw cause;
      }
      if (items.some((item) => !hasIntactProfileEvidence(item, conversations))) {
        throw new AppError("CONFLICT", "原对话已删除或改变，本次整理结果未保存。请重新整理当前对话。");
      }
      return store.addCandidates(items);
    }),
    confirm: (id: string) => execute((store) => { store.confirm(id); return true; }),
    reject: (id: string) => execute((store) => { store.reject(id); return true; }),
    replace: (previousId: string, candidateId: string) => execute((store) => { store.replace(previousId, candidateId); return true; }),
    archive: (id: string) => execute((store) => { store.archive(id); return true; }),
    setResponseAdaptation: (id: string, level: ResponseAdaptation) => execute((store) => {
      store.setResponseAdaptation(id, level);
      return true;
    }),
    edit: (id: string, statement: string, scope?: ProfileScope | null) => execute((store) => {
      store.edit(id, statement, scope);
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
