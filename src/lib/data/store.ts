import type {
  BehaviorPattern,
  DecisionCase,
  DecisionComparison,
  DecisionFeedback,
  DemoState,
  ImprovementGoal,
} from "../../types/domain.ts";
import { createDemoState } from "./fixtures.ts";
import {
  isBehaviorPattern,
  isDecisionCase,
  isDecisionComparison,
  isDecisionFeedback,
  isDemoState,
  isImprovementGoal,
} from "./validation.ts";

export const STORAGE_KEY = "zhiheng.demo.v0.1";

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface DemoStore {
  getState(): DemoState;
  saveCase(record: DecisionCase): void;
  deleteCase(id: string): void;
  savePattern(record: BehaviorPattern): void;
  saveGoal(record: ImprovementGoal): void;
  saveComparison(record: DecisionComparison): void;
  saveFeedback(record: DecisionFeedback): void;
  reset(): void;
}

export function createDemoStore(storage: StorageAdapter): DemoStore {
  function getState(): DemoState {
    let raw: string | null;
    try {
      raw = storage.getItem(STORAGE_KEY);
    } catch {
      throw new Error("无法读取本地数据。请检查浏览器是否允许本地存储。");
    }
    if (raw === null) return createDemoState();
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isDemoState(parsed)) throw new Error("Invalid data");
      return parsed;
    } catch {
      throw new Error(
        "本地数据格式损坏或版本不兼容。原记录未被覆盖，可明确选择重置示例。",
      );
    }
  }

  function persist(state: DemoState): void {
    if (!isDemoState(state)) throw new Error("记录格式不符合公共数据约定。");
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      throw new Error(
        "本地保存失败。浏览器存储可能被禁用或空间不足，修改尚未保存。",
      );
    }
  }

  function mutate(change: (state: DemoState) => void): void {
    const state = getState();
    change(state);
    persist(state);
  }

  function upsert<T extends { id: string; updatedAt: string }>(
    records: T[],
    record: T,
  ): void {
    const copy = structuredClone({
      ...record,
      updatedAt: new Date().toISOString(),
    });
    const index = records.findIndex((item) => item.id === record.id);
    if (index < 0) records.push(copy);
    else records[index] = copy;
  }

  function deactivateGoals(state: DemoState, patternId: string): void {
    for (const goal of state.goals) {
      if (goal.patternId === patternId) {
        goal.status = "inactive";
        goal.updatedAt = new Date().toISOString();
      }
    }
  }

  function invalidateEvidence(
    state: DemoState,
    id: string,
    removeReference: boolean,
  ): void {
    for (const pattern of state.patterns) {
      if (
        !pattern.supportCaseIds.includes(id) &&
        !pattern.counterCaseIds.includes(id)
      )
        continue;
      if (removeReference) {
        pattern.supportCaseIds = pattern.supportCaseIds.filter(
          (entry) => entry !== id,
        );
        pattern.counterCaseIds = pattern.counterCaseIds.filter(
          (entry) => entry !== id,
        );
      }
      if (pattern.status !== "rejected") pattern.status = "pending";
      pattern.updatedAt = new Date().toISOString();
      deactivateGoals(state, pattern.id);
    }
  }

  return {
    getState,
    saveCase(record) {
      if (!record.title.trim()) throw new Error("案例标题不能为空。");
      if (!isDecisionCase(record))
        throw new Error("案例字段不完整，请检查情境、实际选择与来源。");
      mutate((state) => {
        const previous = state.cases.find((item) => item.id === record.id);
        if (previous && JSON.stringify(previous) !== JSON.stringify(record)) {
          invalidateEvidence(state, record.id, record.status === "rejected");
        }
        upsert(state.cases, record);
      });
    },
    deleteCase(id) {
      mutate((state) => {
        state.cases = state.cases.filter((item) => item.id !== id);
        invalidateEvidence(state, id, true);
        // Delete dependent snapshots too; they contain the removed case's text.
        state.comparisons = state.comparisons.filter(
          (item) => !item.evidenceSnapshot.some((entry) => entry.id === id),
        );
        state.feedback = state.feedback.filter((item) =>
          state.comparisons.some((entry) => entry.id === item.comparisonId),
        );
      });
    },
    savePattern(record) {
      if (!isBehaviorPattern(record)) throw new Error("模式字段不完整。");
      mutate((state) => {
        const ids = [...record.supportCaseIds, ...record.counterCaseIds];
        if (
          new Set(ids).size !== ids.length ||
          ids.some(
            (id) =>
              !state.cases.some(
                (entry) =>
                  entry.id === id &&
                  entry.scenario === record.scenario &&
                  entry.status !== "rejected",
              ),
          )
        ) {
          throw new Error("模式证据不存在、重复、已驳回或属于其他场景。");
        }
        if (
          record.status === "confirmed" &&
          (record.supportCaseIds.length === 0 ||
            ids.some(
              (id) =>
                state.cases.find((entry) => entry.id === id)?.status !==
                "confirmed",
            ))
        ) {
          throw new Error("确认模式需要已确认的支持证据。");
        }
        const previous = state.patterns.find((item) => item.id === record.id);
        const changed =
          previous?.status === "confirmed" &&
          (previous.description !== record.description ||
            previous.scenario !== record.scenario ||
            JSON.stringify(previous.supportCaseIds) !==
              JSON.stringify(record.supportCaseIds) ||
            JSON.stringify(previous.counterCaseIds) !==
              JSON.stringify(record.counterCaseIds));
        const next = {
          ...record,
          status: changed ? ("pending" as const) : record.status,
        };
        if (next.status !== "confirmed") deactivateGoals(state, next.id);
        upsert(state.patterns, next);
      });
    },
    saveGoal(record) {
      if (!isImprovementGoal(record))
        throw new Error("目标描述和适用条件不能为空。");
      mutate((state) => {
        if (
          record.patternId !== null &&
          !state.patterns.some(
            (item) =>
              item.id === record.patternId && item.scenario === record.scenario,
          )
        ) {
          throw new Error("关联模式不存在或属于其他场景。");
        }
        if (
          record.status === "active" &&
          record.patternId !== null &&
          !state.patterns.some(
            (item) =>
              item.id === record.patternId && item.status === "confirmed",
          )
        ) {
          throw new Error("关联目标只能对已确认模式启用。");
        }
        upsert(state.goals, record);
      });
    },
    saveComparison(record) {
      if (!isDecisionComparison(record))
        throw new Error("三视角结果格式或证据引用无效。");
      mutate((state) => {
        if (
          record.evidenceSnapshot.some(
            (item) =>
              !state.cases.some(
                (entry) =>
                  entry.id === item.id &&
                  entry.status === "confirmed" &&
                  entry.scenario === record.currentDecision.scenario,
              ),
          )
        )
          throw new Error("生成证据已失效，请重新读取案例。");
        if (
          record.patternSnapshot.some(
            (item) =>
              !state.patterns.some(
                (entry) => entry.id === item.id && entry.status === "confirmed",
              ),
          )
        ) {
          throw new Error("生成模式已失效，请重新读取模式。");
        }
        if (
          record.goalSnapshot &&
          !state.goals.some(
            (item) =>
              item.id === record.goalSnapshot?.id && item.status === "active",
          )
        ) {
          throw new Error("生成目标已停用，请重新读取目标。");
        }
        upsert(state.comparisons, record);
      });
    },
    saveFeedback(record) {
      if (!isDecisionFeedback(record))
        throw new Error("反馈字段不完整，实际选择不能为空。");
      mutate((state) => {
        if (!state.comparisons.some((item) => item.id === record.comparisonId))
          throw new Error("对应决策记录不存在。");
        upsert(state.feedback, record);
      });
    },
    reset() {
      persist(createDemoState());
    },
  };
}
