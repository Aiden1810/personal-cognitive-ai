import type { StorageAdapter } from "../chat/store.ts";
import { AppError } from "../errors.ts";
import { readStorageItem, writeStoredJson } from "../storage/storage.ts";

export const ASSESSMENT_STORAGE_KEY = "zhiheng.profile.assessment.v1";

export type AssessmentLabel = "strength" | "growth";

export interface ProfileTensionNote {
  id: string;
  insightIds: [string, string];
  note: string;
  createdAt: string;
}

export interface AssessmentState {
  version: 1;
  labels: Record<string, AssessmentLabel>;
  tensions: ProfileTensionNote[];
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum;
}

function isTension(value: unknown): value is ProfileTensionNote {
  return record(value) && text(value.id, 100) &&
    Array.isArray(value.insightIds) && value.insightIds.length === 2 &&
    value.insightIds.every((id: unknown) => text(id, 100)) &&
    value.insightIds[0] !== value.insightIds[1] &&
    text(value.note, 500) && typeof value.createdAt === "string" &&
    !Number.isNaN(Date.parse(value.createdAt));
}

function isState(value: unknown): value is AssessmentState {
  return record(value) && value.version === 1 && record(value.labels) &&
    Object.entries(value.labels).length <= 500 &&
    Object.entries(value.labels).every(([id, label]) => text(id, 100) &&
      (label === "strength" || label === "growth")) &&
    Array.isArray(value.tensions) && value.tensions.length <= 200 && value.tensions.every(isTension) &&
    new Set(value.tensions.map((item: ProfileTensionNote) => item.id)).size === value.tensions.length;
}

export function selectCurrentAssessment(state: AssessmentState, confirmedIds: Set<string>) {
  return {
    labels: Object.fromEntries(Object.entries(state.labels).filter(([id]) => confirmedIds.has(id))) as Record<string, AssessmentLabel>,
    tensions: state.tensions.filter((item) => item.insightIds.every((id) => confirmedIds.has(id))),
  };
}

export function createAssessmentStore(storage: StorageAdapter) {
  function getState(): AssessmentState {
    const raw = readStorageItem(storage, ASSESSMENT_STORAGE_KEY, "无法读取画像标记，请检查浏览器存储权限。");
    if (raw === null) return { version: 1, labels: {}, tensions: [] };
    try {
      const value: unknown = JSON.parse(raw);
      if (!isState(value)) throw new Error("Invalid assessment data");
      return value;
    } catch (cause) { throw new AppError("INVALID_STORED_DATA", "本地画像标记格式损坏或版本不兼容；原数据未被覆盖。", { cause, operation: "parse", storageKey: ASSESSMENT_STORAGE_KEY }); }
  }

  function save(state: AssessmentState) {
    writeStoredJson(storage, ASSESSMENT_STORAGE_KEY, state, "画像标记保存失败，修改尚未保存。");
  }

  return {
    getState,
    setLabel(id: string, label: AssessmentLabel | null): void {
      if (!text(id, 100) || (label !== null && label !== "strength" && label !== "growth"))
        throw new AppError("VALIDATION_ERROR", "画像标记无效。");
      const state = getState();
      if (label !== null && !state.labels[id] && Object.keys(state.labels).length >= 500)
        throw new AppError("VALIDATION_ERROR", "本地画像标记已达 500 条。");
      if (label === null) delete state.labels[id];
      else state.labels[id] = label;
      save(state);
    },
    addTension(firstId: string, secondId: string, note: string): ProfileTensionNote {
      if (!text(firstId, 100) || !text(secondId, 100) || firstId === secondId)
        throw new AppError("VALIDATION_ERROR", "请选择两条不同的画像洞察。");
      const trimmed = note.trim();
      if (!text(trimmed, 500)) throw new AppError("VALIDATION_ERROR", "请写下需要核对的地方，最多 500 字。");
      const state = getState();
      if (state.tensions.length >= 200) throw new AppError("VALIDATION_ERROR", "本地核对记录已达 200 条。");
      if (state.tensions.some((item) =>
        item.insightIds.includes(firstId) && item.insightIds.includes(secondId))) {
        throw new AppError("VALIDATION_ERROR", "这两条画像已经在核对列表中。");
      }
      const item: ProfileTensionNote = {
        id: crypto.randomUUID(), insightIds: [firstId, secondId], note: trimmed,
        createdAt: new Date().toISOString(),
      };
      state.tensions.unshift(item);
      save(state);
      return item;
    },
    removeTension(id: string): void {
      const state = getState();
      state.tensions = state.tensions.filter((item) => item.id !== id);
      save(state);
    },
    reset(): void { save({ version: 1, labels: {}, tensions: [] }); },
  };
}
