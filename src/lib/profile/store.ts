import { AppError } from "../errors.ts";
import { readStorageItem, writeStoredJson } from "../storage/storage.ts";
import { COGNITIVE_DIMENSIONS } from "../../types/cognitive.ts";
import type { ProfileInsight } from "../../types/cognitive.ts";
import type { StorageAdapter } from "../chat/store.ts";
import { normalizeProfileStatement } from "./context.ts";

export const PROFILE_STORAGE_KEY = "zhiheng.profile.v1";

export interface ProfileState {
  version: 1;
  insights: ProfileInsight[];
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum;
}

function isInsight(value: unknown): value is ProfileInsight {
  return (
    record(value) &&
    text(value.id, 100) &&
    COGNITIVE_DIMENSIONS.some((dimension) => dimension === value.dimension) &&
    text(value.statement, 500) &&
    (value.origin === "ai_inference" || value.origin === "user_statement") &&
    (value.status === "candidate" || value.status === "confirmed" || value.status === "rejected") &&
    Array.isArray(value.evidence) &&
    value.evidence.length > 0 &&
    value.evidence.length <= 5 &&
    value.evidence.every((source: unknown) =>
      record(source) &&
      text(source.conversationId, 100) &&
      text(source.messageId, 100) &&
      text(source.excerpt, 500)
    )
  );
}

function isState(value: unknown): value is ProfileState {
  return record(value) && value.version === 1 &&
    Array.isArray(value.insights) && value.insights.every(isInsight);
}

export function createProfileStore(storage: StorageAdapter) {
  function getState(): ProfileState {
    const raw = readStorageItem(storage, PROFILE_STORAGE_KEY, "无法读取本地画像，请检查浏览器存储权限。");
    if (raw === null) return { version: 1, insights: [] };
    try {
      const value: unknown = JSON.parse(raw);
      if (!isState(value)) throw new Error("Invalid profile data");
      return value;
    } catch (cause) {
      throw new AppError("INVALID_STORED_DATA", "本地画像格式损坏或版本不兼容；原数据未被覆盖。", { cause, operation: "parse", storageKey: PROFILE_STORAGE_KEY });
    }
  }

  function save(state: ProfileState): void {
    writeStoredJson(storage, PROFILE_STORAGE_KEY, state, "本地画像保存失败，修改尚未保存。");
  }

  function change(id: string, update: (item: ProfileInsight) => void): void {
    const state = getState();
    const item = state.insights.find((insight) => insight.id === id);
    if (!item) throw new AppError("NOT_FOUND", "这条画像洞察不存在。");
    update(item);
    save(state);
  }

  return {
    getState,
    getConfirmedInsights(): ProfileInsight[] {
      return getState().insights.filter((item) => item.status === "confirmed");
    },
    addCandidates(candidates: ProfileInsight[]): number {
      if (!Array.isArray(candidates) || candidates.length > 3 ||
          !candidates.every((item) => isInsight(item) && item.status === "candidate")) {
        throw new AppError("VALIDATION_ERROR", "候选画像数据无效。");
      }
      const state = getState();
      let added = 0;
      for (const item of candidates) {
        const duplicate = state.insights.some((existing) =>
          existing.id === item.id ||
          (existing.dimension === item.dimension &&
           normalizeProfileStatement(existing.statement) === normalizeProfileStatement(item.statement) &&
           item.evidence.every((source) => existing.evidence.some((prior) =>
             prior.conversationId === source.conversationId && prior.messageId === source.messageId)))
        );
        if (!duplicate) {
          state.insights.push(item);
          added++;
        }
      }
      if (added > 0) save(state);
      return added;
    },
    confirm(id: string): void {
      change(id, (item) => { item.status = "confirmed"; });
    },
    reject(id: string): void {
      change(id, (item) => { item.status = "rejected"; });
    },
    edit(id: string, statement: string): void {
      const trimmed = statement.trim();
      if (!text(trimmed, 500)) throw new AppError("VALIDATION_ERROR", "画像描述不能为空或超过 500 字。");
      change(id, (item) => {
        item.statement = trimmed;
        item.origin = "user_statement";
        item.status = "candidate";
      });
    },
    delete(id: string): void {
      const state = getState();
      state.insights = state.insights.filter((item) => item.id !== id);
      save(state);
    },
    removeByConversation(conversationId: string): void {
      const state = getState();
      state.insights = state.insights.filter((item) =>
        !item.evidence.some((source) => source.conversationId === conversationId)
      );
      save(state);
    },
    reset(): void {
      save({ version: 1, insights: [] });
    },
  };
}
