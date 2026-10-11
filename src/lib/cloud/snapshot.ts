import { CHAT_STORAGE_KEY, createChatStore, type ChatState, type StorageAdapter } from "../chat/store.ts";
import { PROFILE_STORAGE_KEY, createProfileStore, type ProfileState } from "../profile/store.ts";
import { GOAL_STORAGE_KEY, createGoalStore, type GoalState } from "../goals/store.ts";
import { ASSESSMENT_STORAGE_KEY, createAssessmentStore, type AssessmentState } from "../profile/assessment.ts";
import { OUTCOME_STORAGE_KEY, createOutcomeStore, type OutcomeState } from "../outcomes/store.ts";
import { AUTO_PROFILE_STORAGE_KEY } from "../profile/auto.ts";
import { RESPONSE_PREFERENCES_STORAGE_KEY, createResponsePreferenceStore, type ResponsePreferenceState } from "../preferences/store.ts";
import { AppError } from "../errors.ts";
import { readStorageItem, storageError } from "../storage/storage.ts";

export interface CloudSnapshot {
  version: 1;
  chat: ChatState;
  profile: ProfileState;
  goals: GoalState;
  assessment: AssessmentState;
  outcomes: OutcomeState;
  preferences?: ResponsePreferenceState;
}

export interface SnapshotStorage extends StorageAdapter {
  removeItem(key: string): void;
}

const keys = [CHAT_STORAGE_KEY, PROFILE_STORAGE_KEY, GOAL_STORAGE_KEY,
  ASSESSMENT_STORAGE_KEY, OUTCOME_STORAGE_KEY, AUTO_PROFILE_STORAGE_KEY, RESPONSE_PREFERENCES_STORAGE_KEY] as const;

export function createLocalSnapshot(storage: StorageAdapter): CloudSnapshot {
  return {
    version: 1,
    chat: createChatStore(storage).getState(),
    profile: createProfileStore(storage).getState(),
    goals: createGoalStore(storage).getState(),
    assessment: createAssessmentStore(storage).getState(),
    outcomes: createOutcomeStore(storage).getState(),
    preferences: createResponsePreferenceStore(storage).getState(),
  };
}

export function parseCloudSnapshot(value: unknown): CloudSnapshot {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      (value as Record<string, unknown>).version !== 1) {
    throw new AppError("VALIDATION_ERROR", "备份格式不兼容，未修改本地资料。");
  }
  const input = value as Record<string, unknown>;
  const raw = new Map<string, string>([
    [CHAT_STORAGE_KEY, JSON.stringify(input.chat ?? null)],
    [PROFILE_STORAGE_KEY, JSON.stringify(input.profile ?? null)],
    [GOAL_STORAGE_KEY, JSON.stringify(input.goals ?? null)],
    [ASSESSMENT_STORAGE_KEY, JSON.stringify(input.assessment ?? null)],
    [OUTCOME_STORAGE_KEY, JSON.stringify(input.outcomes ?? null)],
    ...(input.preferences === undefined ? [] : [[RESPONSE_PREFERENCES_STORAGE_KEY, JSON.stringify(input.preferences)] as [string, string]]),
  ]);
  try {
    return createLocalSnapshot({
      getItem: (key) => raw.get(key) ?? (key === RESPONSE_PREFERENCES_STORAGE_KEY ? null : "null"),
      setItem: () => { throw new Error("只读校验。"); },
    });
  } catch (cause) {
    throw new AppError("VALIDATION_ERROR", "备份资料损坏或版本不兼容，未修改本地资料。", { cause, operation: "validate-backup" });
  }
}

export function snapshotByteLength(snapshot: CloudSnapshot): number {
  return new TextEncoder().encode(JSON.stringify(snapshot)).byteLength;
}

export function restoreLocalSnapshot(value: unknown, storage: SnapshotStorage): void {
  const snapshot = parseCloudSnapshot(value);
  // Importing data does not renew consent to send conversations for automatic extraction.
  const next = [snapshot.chat, snapshot.profile, snapshot.goals, snapshot.assessment, snapshot.outcomes,
    { version: 1, enabled: false, checkpoints: {} }, snapshot.preferences];
  const previous = keys.map((key) => readStorageItem(storage, key, "无法读取恢复前的本地资料，未开始恢复。"));
  let attempted = 0;
  try {
    for (let index = 0; index < keys.length; index++) {
      attempted++;
      storage.setItem(keys[index], JSON.stringify(next[index]));
    }
  } catch (cause) {
    const failedKey = keys[attempted - 1];
    try {
      // Reverse the successful writes so each rollback step returns to a state that fit.
      for (let index = attempted - 1; index >= 0; index--) {
        const old = previous[index];
        if (old === null) storage.removeItem(keys[index]);
        else storage.setItem(keys[index], old);
      }
    } catch (rollbackCause) {
      throw new AppError("ROLLBACK_FAILED", "本地恢复失败且回滚未完成，请勿清理浏览器资料。", {
        cause: new AggregateError([cause, rollbackCause], "恢复及回滚失败"), operation: "restore-backup", storageKey: failedKey,
      });
    }
    const failure = storageError(cause, "write", failedKey, "浏览器存储写入失败。");
    throw new AppError(failure.code, `${failure.message} 已恢复原有本地资料。`, { cause, operation: "restore-backup", storageKey: failedKey });
  }
}
