export const CHAT_STORAGE_KEY = "zhiheng.chat.v1";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
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

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
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
    isTimestamp(value.createdAt)
  );
}

function isConversation(value: unknown): value is Conversation {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt) &&
    Array.isArray(value.messages) &&
    value.messages.every(isMessage)
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
    let raw: string | null;
    try {
      raw = storage.getItem(CHAT_STORAGE_KEY);
    } catch {
      throw new Error("无法读取本地对话，请检查浏览器存储权限。");
    }
    if (raw === null) return { version: 1, conversations: [] };
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isChatState(parsed)) throw new Error("Invalid chat data");
      return parsed;
    } catch {
      throw new Error("本地对话格式损坏或版本不兼容；原数据未被覆盖。");
    }
  }

  function persist(state: ChatState): void {
    try {
      storage.setItem(CHAT_STORAGE_KEY, JSON.stringify(state));
    } catch {
      throw new Error("本地对话保存失败，修改尚未保存。");
    }
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
    ): ChatMessage {
      const trimmed = content.trim();
      if (!trimmed) throw new Error("消息内容不能为空。");
      if (trimmed.length > 10000) throw new Error("消息不能超过 10000 字。");
      const state = getState();
      const conversation = state.conversations.find((item) => item.id === id);
      if (!conversation) throw new Error("对话不存在，请重新选择。");
      const now = new Date().toISOString();
      const message: ChatMessage = {
        id: crypto.randomUUID(),
        role,
        content: trimmed,
        createdAt: now,
      };
      conversation.messages.push(message);
      if (conversation.messages.length === 1 && role === "user") {
        conversation.title = trimmed.slice(0, 28);
      }
      conversation.updatedAt = now;
      persist(state);
      return message;
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
