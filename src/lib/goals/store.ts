import { AppError } from "../errors.ts";
import { readStorageItem, writeStoredJson } from "../storage/storage.ts";
import { COGNITIVE_DIMENSIONS } from "../../types/cognitive.ts";
import type { CognitiveDimension, UserGoal } from "../../types/cognitive.ts";
import type { StorageAdapter } from "../chat/store.ts";

export const GOAL_STORAGE_KEY = "zhiheng.goals.v1";

export interface GoalState {
  version: 1;
  goals: UserGoal[];
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum;
}

function validGoal(value: unknown): value is UserGoal {
  return record(value) && text(value.id, 100) &&
    COGNITIVE_DIMENSIONS.some((dimension) => dimension === value.dimension) &&
    text(value.intention, 500) &&
    (value.status === "active" || value.status === "paused");
}

function validState(value: unknown): value is GoalState {
  return record(value) && value.version === 1 && Array.isArray(value.goals) &&
    value.goals.length <= COGNITIVE_DIMENSIONS.length && value.goals.every(validGoal) &&
    new Set(value.goals.map((goal: UserGoal) => goal.id)).size === value.goals.length &&
    new Set(value.goals.map((goal: UserGoal) => goal.dimension)).size === value.goals.length;
}

export function createGoalStore(storage: StorageAdapter) {
  function getState(): GoalState {
    const raw = readStorageItem(storage, GOAL_STORAGE_KEY, "无法读取本地目标，请检查浏览器存储权限。");
    if (raw === null) return { version: 1, goals: [] };
    try {
      const value: unknown = JSON.parse(raw);
      if (!validState(value)) throw new Error("Invalid goal data");
      return value;
    } catch (cause) {
      throw new AppError("INVALID_STORED_DATA", "本地目标格式损坏或版本不兼容；原数据未被覆盖。", { cause, operation: "parse", storageKey: GOAL_STORAGE_KEY });
    }
  }

  function save(state: GoalState): void {
    writeStoredJson(storage, GOAL_STORAGE_KEY, state, "本地目标保存失败，修改尚未保存。");
  }

  function changeStatus(id: string, status: UserGoal["status"]): void {
    const state = getState();
    const goal = state.goals.find((item) => item.id === id);
    if (!goal) throw new AppError("NOT_FOUND", "这项目标不存在。");
    goal.status = status;
    save(state);
  }

  return {
    getState,
    getActiveGoals(): UserGoal[] {
      return getState().goals.filter((goal) => goal.status === "active");
    },
    upsert(dimension: CognitiveDimension, intention: string): UserGoal {
      if (!COGNITIVE_DIMENSIONS.includes(dimension)) throw new AppError("VALIDATION_ERROR", "目标维度无效。");
      const trimmed = intention.trim();
      if (!text(trimmed, 500)) throw new AppError("VALIDATION_ERROR", "目标不能为空或超过 500 字。");
      const state = getState();
      let goal = state.goals.find((item) => item.dimension === dimension);
      if (goal) {
        goal.intention = trimmed;
        goal.status = "active";
      } else {
        goal = { id: crypto.randomUUID(), dimension, intention: trimmed, status: "active" };
        state.goals.push(goal);
      }
      save(state);
      return goal;
    },
    pause(id: string): void {
      changeStatus(id, "paused");
    },
    resume(id: string): void {
      changeStatus(id, "active");
    },
    delete(id: string): void {
      const state = getState();
      state.goals = state.goals.filter((goal) => goal.id !== id);
      save(state);
    },
    reset(): void {
      save({ version: 1, goals: [] });
    },
  };
}
