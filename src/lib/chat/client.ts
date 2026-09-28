"use client";

import { useSyncExternalStore } from "react";
import { createChatStore, CHAT_STORAGE_KEY } from "./store";
import type { ChatMessage, ChatState } from "./store";

interface ChatSnapshot {
  state: ChatState | null;
  ready: boolean;
  error: string | null;
}

const initial: ChatSnapshot = { state: null, ready: false, error: null };
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
      state: createChatStore(window.localStorage).getState(),
      ready: true,
      error: null,
    };
  } catch (error) {
    snapshot = {
      state: null,
      ready: true,
      error: error instanceof Error ? error.message : "读取本地对话失败。",
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
    const result = action(createChatStore(window.localStorage));
    refresh();
    publish();
    return result;
  } catch (error) {
    snapshot = {
      ...snapshot,
      ready: true,
      error: error instanceof Error ? error.message : "本地保存失败。",
    };
    publish();
    return null;
  }
}

export function useChatData() {
  const data = useSyncExternalStore(subscribe, getSnapshot, () => initial);
  return {
    ...data,
    createConversation: () => execute((store) => store.createConversation()),
    appendMessage: (id: string, role: ChatMessage["role"], content: string) =>
      execute((store) => store.appendMessage(id, role, content)),
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
