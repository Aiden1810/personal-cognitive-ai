import { isChatSuggestion, type ChatSuggestion } from "./suggestions.ts";
import { AppError } from "../errors.ts";
import { isChatReferenceRecord, type ChatReferenceRecord } from "./references.ts";
import { readStorageItem, writeStoredJson, type StorageAdapter } from "../storage/storage.ts";
export type { StorageAdapter } from "../storage/storage.ts";

export const CHAT_STORAGE_KEY = "zhiheng.chat.v1";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  suggestions?: ChatSuggestion[];
  references?: ChatReferenceRecord;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface ChatState {
  version: 1;
  conversations: Conversation[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isMessage(value: unknown): value is ChatMessage {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    (value.role === "user" || value.role === "assistant") &&
    typeof value.content === "string" &&
    value.content.trim().length > 0 &&
    isTimestamp(value.createdAt) &&
    (value.references === undefined || (value.role === "assistant" && isChatReferenceRecord(value.references))) &&
    (value.suggestions === undefined || (value.role === "assistant" && Array.isArray(value.suggestions) &&
      value.suggestions.length <= 3 && value.suggestions.every(isChatSuggestion) &&
      new Set(value.suggestions.map((item: ChatSuggestion) => item.id)).size === value.suggestions.length &&
      new Set(value.suggestions.map((item: ChatSuggestion) => item.kind)).size === value.suggestions.length))
  );
}

function validSuggestionSources(messages: ChatMessage[]): boolean {
  return messages.every((message, index) => (message.suggestions ?? []).every((suggestion) => {
    const source = messages[index - 1];
    return source?.role === "user" && source.id === suggestion.sourceMessageId && source.content.includes(suggestion.excerpt);
  }));
}

function validReferenceSources(messages: ChatMessage[]): boolean {
  return messages.every((message, index) => message.references === undefined ||
    (messages[index - 1]?.role === "user" && messages[index - 1].id === message.references.sourceMessageId));
}

function isConversation(value: unknown): value is Conversation {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt) &&
    Array.isArray(value.messages) &&
    value.messages.every(isMessage) && validSuggestionSources(value.messages) && validReferenceSources(value.messages)
  );
}

function isChatState(value: unknown): value is ChatState {
  return (
    isRecord(value) &&
    value.version === 1 &&
    Array.isArray(value.conversations) &&
    value.conversations.every(isConversation)
  );
}

export function createChatStore(storage: StorageAdapter) {
  function getState(): ChatState {
    const raw = readStorageItem(storage, CHAT_STORAGE_KEY, "无法读取本地对话，请检查浏览器存储权限。");
    if (raw === null) return { version: 1, conversations: [] };
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isChatState(parsed)) throw new Error("Invalid chat data");
      return parsed;
    } catch (cause) {
      throw new AppError("INVALID_STORED_DATA", "本地对话格式损坏或版本不兼容；原数据未被覆盖。", { cause, operation: "parse", storageKey: CHAT_STORAGE_KEY });
    }
  }

  function persist(state: ChatState): void {
    writeStoredJson(storage, CHAT_STORAGE_KEY, state, "本地对话保存失败，修改尚未保存。");
  }

  return {
    getState,
    createConversation(): Conversation {
      const state = getState();
      const now = new Date().toISOString();
      const conversation: Conversation = {
        id: crypto.randomUUID(),
        title: "新对话",
        createdAt: now,
        updatedAt: now,
        messages: [],
      };
      state.conversations.unshift(conversation);
      persist(state);
      return conversation;
    },
    appendMessage(
      id: string,
      role: ChatMessage["role"],
      content: string,
      references?: ChatReferenceRecord,
    ): ChatMessage {
      const trimmed = content.trim();
      if (!trimmed) throw new AppError("VALIDATION_ERROR", "消息内容不能为空。");
      if (trimmed.length > 10000) throw new AppError("VALIDATION_ERROR", "消息不能超过 10000 字。");
      const state = getState();
      const conversation = state.conversations.find((item) => item.id === id);
      if (!conversation) throw new AppError("NOT_FOUND", "对话不存在，请重新选择。");
      if (references !== undefined && (role !== "assistant" || !isChatReferenceRecord(references) ||
          conversation.messages.at(-1)?.role !== "user" || conversation.messages.at(-1)?.id !== references.sourceMessageId)) {
        throw new AppError("VALIDATION_ERROR", "参考资料记录或对应提问无效，回复未保存。");
      }
      const now = new Date().toISOString();
      const message: ChatMessage = {
        id: crypto.randomUUID(),
        role,
        content: trimmed,
        createdAt: now,
        ...(references ? { references } : {}),
      };
      conversation.messages.push(message);
      if (conversation.messages.length === 1 && role === "user") {
        conversation.title = trimmed.slice(0, 28);
      }
      conversation.updatedAt = now;
      persist(state);
      return message;
    },
    setSuggestions(id: string, messageId: string, suggestions: ChatSuggestion[]): void {
      const state = getState();
      const conversation = state.conversations.find((item) => item.id === id);
      const message = conversation?.messages.find((item) => item.id === messageId);
      if (!conversation || message?.role !== "assistant") throw new AppError("VALIDATION_ERROR", "建议只能保存到有效的助手回复。");
      if (message.suggestions !== undefined) throw new AppError("CONFLICT", "这条回复的建议已生成，不重复覆盖。");
      const updated = { ...message, suggestions };
      if (!isMessage(updated) || suggestions.some((item) => item.status !== "pending") ||
        !validSuggestionSources(conversation.messages.map((item) => item.id === messageId ? updated : item))) {
        throw new AppError("VALIDATION_ERROR", "建议来源或内容无效，未保存。");
      }
      message.suggestions = suggestions;
      persist(state);
    },
    setSuggestionStatus(id: string, messageId: string, suggestionId: string, status: "dismissed" | "completed"): void {
      if (status !== "dismissed" && status !== "completed") throw new AppError("VALIDATION_ERROR", "建议状态无效。");
      const state = getState();
      const message = state.conversations.find((item) => item.id === id)?.messages.find((item) => item.id === messageId);
      const suggestion = message?.suggestions?.find((item) => item.id === suggestionId);
      if (!suggestion || suggestion.status !== "pending") throw new AppError("CONFLICT", "建议已处理或不存在。");
      suggestion.status = status;
      persist(state);
    },
    deleteConversation(id: string): void {
      const state = getState();
      state.conversations = state.conversations.filter(
        (item) => item.id !== id,
      );
      persist(state);
    },
    reset(): void {
      persist({ version: 1, conversations: [] });
    },
  };
}
