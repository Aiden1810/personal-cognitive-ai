"use client";

import { errorState, type AppErrorCode } from "../errors.ts";
import { getBrowserStorage } from "../storage/browser.ts";

import { useSyncExternalStore } from "react";
import { createChatStore, CHAT_STORAGE_KEY } from "./store";
import type { ChatMessage, ChatState, Conversation } from "./store";
import type { ChatSuggestion } from "./suggestions";
import type { ChatReferenceRecord } from "./references";
import { applyChatSuggestion, type SuggestionConfirmation } from "./actions";
import { refreshGoalData } from "../goals/client";
import { refreshProfileData } from "../profile/client";
import { refreshOutcomeData } from "../outcomes/client";

interface ChatSnapshot {
  state: ChatState | null;
  ready: boolean;
  error: string | null;
  errorCode: AppErrorCode | null;
}

const initial: ChatSnapshot = { state: null, ready: false, error: null, errorCode: null };
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
      state: createChatStore(getBrowserStorage()).getState(),
      ready: true,
      error: null,
      errorCode: null,
    };
  } catch (error) {
    const failure = errorState(error, "读取本地对话失败。");
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
    if (event.key === CHAT_STORAGE_KEY || event.key === null) {
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

function execute<T>(
  action: (store: ReturnType<typeof createChatStore>) => T,
): T | null {
  try {
    const result = action(createChatStore(getBrowserStorage()));
    refresh();
    publish();
    return result;
  } catch (error) {
    snapshot = {
      ...snapshot,
      ready: true,
      ...errorState(error, "本地保存失败。"),
    };
    publish();
    return null;
  }
}

function executeSuggestion(action: (store: ReturnType<typeof createChatStore>) => void): true {
  try { action(createChatStore(getBrowserStorage())); return true; }
  finally {
    // Suggestion failures belong to their card; intact chats must remain usable.
    refresh(); publish();
  }
}

export function useChatData() {
  const data = useSyncExternalStore(subscribe, getSnapshot, () => initial);
  return {
    ...data,
    retryLoad: () => { refresh(); publish(); },
    createConversation: () => execute((store) => store.createConversation()),
    appendMessage: (id: string, role: ChatMessage["role"], content: string, references?: ChatReferenceRecord) =>
      execute((store) => store.appendMessage(id, role, content, references)),
    setSuggestions: (id: string, messageId: string, suggestions: ChatSuggestion[]) =>
      executeSuggestion((store) => store.setSuggestions(id, messageId, suggestions)),
    dismissSuggestion: (id: string, messageId: string, suggestionId: string) =>
      executeSuggestion((store) => store.setSuggestionStatus(id, messageId, suggestionId, "dismissed")),
    confirmSuggestion: (id: string, messageId: string, suggestionId: string, confirmation: SuggestionConfirmation) => {
      try { return applyChatSuggestion(getBrowserStorage(), id, messageId, suggestionId, confirmation); }
      finally {
        // Keep mounted views in this tab consistent after either a save or rollback.
        refresh(); publish(); refreshGoalData(); refreshProfileData(); refreshOutcomeData();
      }
    },
    deleteConversation: (id: string) =>
      execute((store) => {
        store.deleteConversation(id);
        return true;
      }),
    reset: () =>
      execute((store) => {
        store.reset();
        return true;
      }),
  };
}

export function getSavedConversation(id: string): Conversation | null {
  return createChatStore(getBrowserStorage()).getState().conversations.find((item) => item.id === id) ?? null;
}
