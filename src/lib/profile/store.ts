import { COGNITIVE_DIMENSIONS } from "../../types/cognitive.ts";
import type { ProfileInsight } from "../../types/cognitive.ts";
import type { StorageAdapter } from "../chat/store.ts";
import { normalizeProfileStatement } from "./context.ts";
import { isProfileScope } from "./scope.ts";
import type { ProfileScope } from "../../types/cognitive.ts";
import type { ResponseAdaptation } from "../../types/cognitive.ts";
import { isResponseAdaptation } from "./adaptation.ts";
import { isEvidenceReference, evidenceKey } from "./evidence.ts";
import { isTraitDimension, isTraitLevel } from "./questionnaire.ts";
import type { TraitLevel } from "../../types/cognitive.ts";
import { AppError } from "../errors.ts";
import { readStorageItem, writeStoredJson } from "../storage/storage.ts";

export const PROFILE_STORAGE_KEY = "zhiheng.profile.v1";

export interface ProfileState {
  version: 1;
  insights: ProfileInsight[];
  onboarding?: { version: 1; status: "skipped" | "completed" };
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
    (value.status === "candidate" || value.status === "confirmed" || value.status === "rejected" || value.status === "archived") &&
    (value.scope === undefined || isProfileScope(value.scope)) &&
    (value.responseAdaptation === undefined || isResponseAdaptation(value.responseAdaptation)) &&
    (value.currentLevel === undefined || (isTraitDimension(value.dimension) && isTraitLevel(value.currentLevel))) &&
    Array.isArray(value.evidence) &&
    value.evidence.length > 0 &&
    value.evidence.length <= 5 &&
    value.evidence.every((source: unknown) => isEvidenceReference(source, value.dimension as ProfileInsight["dimension"]))
  );
}

function isState(value: unknown): value is ProfileState {
  return record(value) && value.version === 1 &&
    Array.isArray(value.insights) && value.insights.every(isInsight) &&
    (value.onboarding === undefined || (record(value.onboarding) && value.onboarding.version === 1 &&
      (value.onboarding.status === "skipped" || value.onboarding.status === "completed")));
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
             source.kind === "questionnaire" || prior.kind === "questionnaire" ? evidenceKey(prior) === evidenceKey(source) :
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
    skipQuestionnaire(): void {
      const state = getState();
      // Retaking and cancelling must not erase the prior completed state.
      if (state.onboarding?.status !== "completed") state.onboarding = { version: 1, status: "skipped" };
      save(state);
    },
    completeQuestionnaire(items: ProfileInsight[]): void {
      if (!Array.isArray(items) || items.length > 5 || new Set(items.map((item) => item.dimension)).size !== items.length ||
          !items.every((item) => isInsight(item) && isTraitDimension(item.dimension) && item.origin === "user_statement" &&
            item.status === "confirmed" && item.evidence.every((source) => source.kind === "questionnaire"))) {
        throw new AppError("VALIDATION_ERROR", "问卷画像无效，未保存。");
      }
      const state = getState();
      if (items.some((item) => state.insights.some((existing) => existing.id === item.id))) throw new AppError("VALIDATION_ERROR", "问卷记录编号重复。");
      for (const previous of state.insights) {
        if (previous.status === "confirmed" && previous.evidence.every((source) => source.kind === "questionnaire") &&
            items.some((item) => item.dimension === previous.dimension)) previous.status = "archived";
      }
      state.insights.push(...items);
      state.onboarding = { version: 1, status: "completed" };
      save(state);
    },
    setCurrentLevel(id: string, level: TraitLevel): void {
      if (!isTraitLevel(level)) throw new AppError("VALIDATION_ERROR", "当前档位无效。");
      change(id, (item) => {
        if (!isTraitDimension(item.dimension)) throw new AppError("VALIDATION_ERROR", "背景资料不设置行为档位。");
        item.currentLevel = level;
      });
    },
    reject(id: string): void {
      change(id, (item) => { item.status = "rejected"; });
    },
    replace(previousId: string, candidateId: string): void {
      const state = getState();
      const previous = state.insights.find((item) => item.id === previousId);
      const candidate = state.insights.find((item) => item.id === candidateId);
      if (!previous || !candidate || previous.id === candidate.id || previous.status !== "confirmed" || candidate.status !== "candidate") {
        throw new AppError("VALIDATION_ERROR", "请选择一条已确认的旧记忆和一条待审核的新记忆。");
      }
      if (previous.dimension !== candidate.dimension) throw new AppError("VALIDATION_ERROR", "更新只能在同一维度内进行。");
      previous.status = "archived";
      candidate.status = "confirmed";
      save(state);
    },
    archive(id: string): void {
      change(id, (item) => { item.status = "archived"; });
    },
    setResponseAdaptation(id: string, level: ResponseAdaptation): void {
      if (!isResponseAdaptation(level)) throw new AppError("VALIDATION_ERROR", "回答适配程度无效，请选择低、中或高。");
      // This setting changes response support, not the reviewed statement or evidence.
      change(id, (item) => { item.responseAdaptation = level; });
    },
    edit(id: string, statement: string, scope?: ProfileScope | null): void {
      const trimmed = statement.trim();
      if (!text(trimmed, 500)) throw new AppError("VALIDATION_ERROR", "画像描述不能为空或超过 500 字。");
      if (scope !== undefined && scope !== null && !isProfileScope(scope)) throw new AppError("VALIDATION_ERROR", "画像范围无效。");
      change(id, (item) => {
        item.statement = trimmed;
        item.origin = "user_statement";
        item.status = "candidate";
        if (scope === null) delete item.scope;
        else if (scope !== undefined) item.scope = scope;
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
        !item.evidence.some((source) => source.kind !== "questionnaire" && source.conversationId === conversationId)
      );
      save(state);
    },
    reset(): void {
      save({ version: 1, insights: [] });
    },
  };
}
