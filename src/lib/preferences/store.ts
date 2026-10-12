import type { StorageAdapter } from "../chat/store.ts";
import { AppError } from "../errors.ts";
import { readStorageItem, writeStoredJson } from "../storage/storage.ts";

export const RESPONSE_PREFERENCES_STORAGE_KEY = "zhiheng.response-preferences.v1";
export const RESPONSE_PREFERENCE_OPTIONS = {
  length: { brief: "简短一点", balanced: "适中", detailed: "详细解释" },
  explanation: { plain: "适合初学者", standard: "正常说明", technical: "保留技术细节" },
  structure: { conclusion_steps: "先给结论，再列步骤", natural: "自然回答" },
} as const;
export interface ResponsePreferences {
  length: keyof typeof RESPONSE_PREFERENCE_OPTIONS.length;
  explanation: keyof typeof RESPONSE_PREFERENCE_OPTIONS.explanation;
  structure: keyof typeof RESPONSE_PREFERENCE_OPTIONS.structure;
}
export interface PersonalContext {
  enabled: boolean;
  background: string;
  instructions: string;
  updatedAt: string;
}
export type PersonalContextInput = Omit<PersonalContext, "updatedAt">;
export interface ResponsePreferenceState { version: 1; preferences: ResponsePreferences; personalContext?: PersonalContext; }
export const MAX_BACKGROUND_CHARACTERS = 3000;
export const MAX_CUSTOM_INSTRUCTIONS_CHARACTERS = 2000;
export const DEFAULT_RESPONSE_PREFERENCES: ResponsePreferences = { length: "balanced", explanation: "standard", structure: "natural" };

export function isResponsePreferences(value: unknown): value is ResponsePreferences {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  return Object.keys(input).length === 3 &&
    Object.entries(RESPONSE_PREFERENCE_OPTIONS).every(([field, options]) =>
      typeof input[field] === "string" && Object.hasOwn(options, input[field]));
}

export function describeResponsePreferences(preferences: ResponsePreferences): string {
  return [RESPONSE_PREFERENCE_OPTIONS.length[preferences.length], RESPONSE_PREFERENCE_OPTIONS.explanation[preferences.explanation], RESPONSE_PREFERENCE_OPTIONS.structure[preferences.structure]].join(" · ");
}

export function isPersonalContext(value: unknown): value is PersonalContext {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  return typeof input.enabled === "boolean" && typeof input.background === "string" && input.background.length <= MAX_BACKGROUND_CHARACTERS &&
    typeof input.instructions === "string" && input.instructions.length <= MAX_CUSTOM_INSTRUCTIONS_CHARACTERS &&
    typeof input.updatedAt === "string" && input.updatedAt.length <= 50 && !Number.isNaN(Date.parse(input.updatedAt));
}

export function activePersonalContext(value?: PersonalContext): PersonalContext | undefined {
  if (!value || !value.enabled || (!value.background.trim() && !value.instructions.trim())) return undefined;
  if (!isPersonalContext(value)) throw new AppError("VALIDATION_ERROR", "个人背景与回答要求无效。");
  return { enabled: true, background: value.background, instructions: value.instructions, updatedAt: value.updatedAt };
}

export function createResponsePreferenceStore(storage: StorageAdapter) {
  function getState(): ResponsePreferenceState {
    const raw = readStorageItem(storage, RESPONSE_PREFERENCES_STORAGE_KEY, "无法读取回答偏好，请检查浏览器存储权限。");
    if (raw === null) return { version: 1, preferences: { ...DEFAULT_RESPONSE_PREFERENCES } };
    try {
      const state = JSON.parse(raw);
      if (state?.version !== 1 || !isResponsePreferences(state.preferences) ||
          (state.personalContext !== undefined && !isPersonalContext(state.personalContext))) throw Error();
      return { version: 1, preferences: { ...state.preferences }, ...(state.personalContext ? { personalContext: { enabled: state.personalContext.enabled, background: state.personalContext.background, instructions: state.personalContext.instructions, updatedAt: state.personalContext.updatedAt } } : {}) };
    } catch (cause) { throw new AppError("INVALID_STORED_DATA", "回答偏好格式损坏，原设置未被覆盖。", { cause, operation: "parse", storageKey: RESPONSE_PREFERENCES_STORAGE_KEY }); }
  }
  function write(state: ResponsePreferenceState) {
    writeStoredJson(storage, RESPONSE_PREFERENCES_STORAGE_KEY, state, "个人设置保存失败，原设置未修改。");
  }
  return {
    getState,
    save(preferences: ResponsePreferences) {
      if (!isResponsePreferences(preferences)) throw new AppError("VALIDATION_ERROR", "回答偏好无效。");
      write({ ...getState(), preferences: { ...preferences } });
    },
    savePersonalContext(input: PersonalContextInput) {
      if (typeof input.background !== "string" || input.background.length > MAX_BACKGROUND_CHARACTERS) throw new AppError("VALIDATION_ERROR", "个人背景最多 3000 字。");
      if (typeof input.instructions !== "string" || input.instructions.length > MAX_CUSTOM_INSTRUCTIONS_CHARACTERS) throw new AppError("VALIDATION_ERROR", "回答要求最多 2000 字。");
      if (typeof input.enabled !== "boolean") throw new AppError("VALIDATION_ERROR", "个人设置开关无效。");
      const state = getState();
      state.personalContext = { enabled: input.enabled, background: input.background.trim(), instructions: input.instructions.trim(), updatedAt: new Date().toISOString() };
      write(state);
    },
    clearPersonalContext() {
      const state = getState(); delete state.personalContext; write(state);
    },
  };
}
