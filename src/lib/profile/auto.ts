import type { Conversation, StorageAdapter } from "../chat/store.ts";
import { AppError } from "../errors.ts";
import { readStorageItem, writeStoredJson } from "../storage/storage.ts";

export const AUTO_PROFILE_STORAGE_KEY = "zhiheng.profile.auto.v1";
export interface AutoProfileState {
  version: 1;
  enabled: boolean;
  checkpoints: Record<string, string>;
}

function lastUserId(conversation: Conversation): string | undefined {
  return conversation.messages.findLast((message) => message.role === "user")?.id;
}

export function shouldAutoExtract(conversation: Conversation, state: AutoProfileState): boolean {
  if (!state.enabled) return false;
  const users = conversation.messages.filter((message) => message.role === "user");
  const checkpoint = state.checkpoints[conversation.id];
  const index = checkpoint ? users.findIndex((message) => message.id === checkpoint) : -1;
  return users.length - index - 1 >= 4;
}

export function canCommitAutoExtraction(
  source: Conversation,
  started: AutoProfileState,
  latest: Conversation | null,
  current: AutoProfileState,
): boolean {
  if (!started.enabled || !current.enabled || !latest || latest.id !== source.id ||
      current.checkpoints[source.id] !== started.checkpoints[source.id]) return false;
  return source.messages.filter((message) => message.role === "user").every((message) =>
    latest.messages.some((item) => item.id === message.id && item.role === "user" && item.content === message.content)
  );
}

export function createAutoProfileStore(storage: StorageAdapter) {
  function getState(): AutoProfileState {
    const raw = readStorageItem(storage, AUTO_PROFILE_STORAGE_KEY, "无法读取自动提取设置，请检查浏览器存储权限。");
    if (raw === null) return { version: 1, enabled: false, checkpoints: {} };
    try {
      const value: unknown = JSON.parse(raw);
      if (typeof value !== "object" || value === null || Array.isArray(value)) throw Error();
      const state = value as Record<string, unknown>;
      if (state.version !== 1 || typeof state.enabled !== "boolean" ||
          typeof state.checkpoints !== "object" || state.checkpoints === null || Array.isArray(state.checkpoints) ||
          Object.entries(state.checkpoints).some(([id, messageId]) => !id || id.length > 100 || typeof messageId !== "string" || !messageId || messageId.length > 100)) throw Error();
      return state as unknown as AutoProfileState;
    } catch (cause) { throw new AppError("INVALID_STORED_DATA", "自动提取设置格式损坏；原数据未被覆盖。", { cause, operation: "parse", storageKey: AUTO_PROFILE_STORAGE_KEY }); }
  }
  function save(state: AutoProfileState) {
    writeStoredJson(storage, AUTO_PROFILE_STORAGE_KEY, state, "自动提取设置保存失败。");
  }
  return {
    getState,
    setEnabled(enabled: boolean, conversations: Conversation[]) {
      const state = getState();
      if (enabled && !state.enabled) {
        for (const conversation of conversations) {
          const id = lastUserId(conversation);
          if (id) state.checkpoints[conversation.id] = id;
        }
      }
      state.enabled = enabled;
      save(state);
    },
    markProcessed(conversation: Conversation) {
      const id = lastUserId(conversation);
      if (!id) return;
      const state = getState();
      state.checkpoints[conversation.id] = id;
      save(state);
    },
    forgetConversation(id: string) {
      const state = getState();
      delete state.checkpoints[id];
      save(state);
    },
    resetCheckpoints() {
      const state = getState();
      state.checkpoints = {};
      save(state);
    },
  };
}
