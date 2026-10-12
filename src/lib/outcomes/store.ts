import { COGNITIVE_DIMENSIONS, type CognitiveDimension, type UserGoal } from "../../types/cognitive.ts";
import type { StorageAdapter } from "../chat/store.ts";
import { AppError } from "../errors.ts";
import { readStorageItem, writeStoredJson } from "../storage/storage.ts";

export const OUTCOME_STORAGE_KEY = "zhiheng.outcomes.v1";

export type OutcomeRating = "toward" | "unclear" | "away";

export interface OutcomeEntry {
  id: string;
  goalId: string;
  dimension: CognitiveDimension;
  goalIntention: string;
  action: string;
  result: string;
  rating: OutcomeRating;
  createdAt: string;
}

export interface OutcomeState {
  version: 1;
  entries: OutcomeEntry[];
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum;
}

function isEntry(value: unknown): value is OutcomeEntry {
  return record(value) && text(value.id, 100) && text(value.goalId, 100) &&
    COGNITIVE_DIMENSIONS.some((dimension) => dimension === value.dimension) &&
    text(value.goalIntention, 500) && text(value.action, 500) && text(value.result, 1000) &&
    (value.rating === "toward" || value.rating === "unclear" || value.rating === "away") &&
    typeof value.createdAt === "string" && !Number.isNaN(Date.parse(value.createdAt));
}

function isState(value: unknown): value is OutcomeState {
  return record(value) && value.version === 1 && Array.isArray(value.entries) &&
    value.entries.length <= 500 && value.entries.every(isEntry) &&
    new Set(value.entries.map((entry: OutcomeEntry) => entry.id)).size === value.entries.length;
}

export function summarizeOutcomes(entries: OutcomeEntry[]) {
  return entries.reduce((summary, entry) => {
    summary[entry.rating]++;
    return summary;
  }, { toward: 0, unclear: 0, away: 0 });
}

export function compareRecentOutcomes(entries: OutcomeEntry[], goalId: string) {
  const latest = entries.filter((entry) => entry.goalId === goalId).slice(0, 6);
  if (latest.length < 6) return null;
  const recent = latest.slice(0, 3);
  const previous = latest.slice(3);
  return {
    recentToward: recent.filter((entry) => entry.rating === "toward").length,
    previousToward: previous.filter((entry) => entry.rating === "toward").length,
    recentAway: recent.filter((entry) => entry.rating === "away").length,
    previousAway: previous.filter((entry) => entry.rating === "away").length,
  };
}

export function createOutcomeStore(storage: StorageAdapter) {
  function getState(): OutcomeState {
    const raw = readStorageItem(storage, OUTCOME_STORAGE_KEY, "无法读取行动反馈，请检查浏览器存储权限。");
    if (raw === null) return { version: 1, entries: [] };
    try {
      const value: unknown = JSON.parse(raw);
      if (!isState(value)) throw new Error("Invalid feedback data");
      return value;
    } catch (cause) { throw new AppError("INVALID_STORED_DATA", "本地行动反馈格式损坏或版本不兼容；原数据未被覆盖。", { cause, operation: "parse", storageKey: OUTCOME_STORAGE_KEY }); }
  }

  function save(state: OutcomeState) {
    writeStoredJson(storage, OUTCOME_STORAGE_KEY, state, "行动反馈保存失败，修改尚未保存。");
  }

  return {
    getState,
    add(goal: UserGoal, action: string, result: string, rating: OutcomeRating): OutcomeEntry {
      if (!text(action.trim(), 500)) throw new AppError("VALIDATION_ERROR", "请填写实际选择，最多 500 字。");
      if (!text(result.trim(), 1000)) throw new AppError("VALIDATION_ERROR", "请填写观察到的结果，最多 1000 字。");
      if (!text(goal.id, 100) || !text(goal.intention, 500) ||
          !COGNITIVE_DIMENSIONS.includes(goal.dimension) ||
          !["toward", "unclear", "away"].includes(rating)) {
        throw new AppError("VALIDATION_ERROR", "目标或反馈状态无效。");
      }
      const state = getState();
      if (state.entries.length >= 500) throw new AppError("VALIDATION_ERROR", "本地反馈已达 500 条，请先整理旧记录。");
      const entry: OutcomeEntry = {
        id: crypto.randomUUID(), goalId: goal.id, dimension: goal.dimension,
        goalIntention: goal.intention, action: action.trim(), result: result.trim(),
        rating, createdAt: new Date().toISOString(),
      };
      state.entries.unshift(entry);
      save(state);
      return entry;
    },
    delete(id: string): void {
      const state = getState();
      state.entries = state.entries.filter((entry) => entry.id !== id);
      save(state);
    },
    reset(): void { save({ version: 1, entries: [] }); },
  };
}
