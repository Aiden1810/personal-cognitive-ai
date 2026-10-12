import { createChatStore, type StorageAdapter } from "./store.ts";
import { createGoalStore } from "../goals/store.ts";
import { createProfileStore } from "../profile/store.ts";
import { createOutcomeStore, type OutcomeRating } from "../outcomes/store.ts";
import { usableProfileInsights } from "../profile/usable.ts";
import type { GoalWillingness, UserGoal, TraitLevel } from "../../types/cognitive.ts";
import { AppError } from "../errors.ts";
import { readStorageItem, storageError } from "../storage/storage.ts";

export type SuggestionConfirmation =
  | { kind: "goal"; intention: string; willingness?: GoalWillingness | null; targetLevel?: TraitLevel | null; expectedGoal: UserGoal | null }
  | { kind: "archive" }
  | { kind: "outcome"; action: string; result: string; rating: OutcomeRating };

interface ActionStorage extends StorageAdapter {
  removeItem(key: string): void;
}

function sameGoal(current: UserGoal | undefined, expected: UserGoal | null): boolean {
  if (!current || !expected) return !current && !expected;
  return current.id === expected.id && current.dimension === expected.dimension && current.intention === expected.intention &&
    current.status === expected.status && current.willingness === expected.willingness && current.targetLevel === expected.targetLevel;
}

// Stage writes through existing stores, then save business data and the handled state together.
// This is only called from an explicit confirmation; the model never receives this function.
export function applyChatSuggestion(
  storage: ActionStorage, conversationId: string, messageId: string, suggestionId: string,
  confirmation: SuggestionConfirmation,
): UserGoal | true {
  const staged = new Map<string, string>();
  const overlay: StorageAdapter = {
    getItem: (key) => staged.get(key) ?? storage.getItem(key),
    setItem: (key, value) => { staged.set(key, value); },
  };
  const chat = createChatStore(overlay);
  const conversations = chat.getState().conversations;
  const suggestion = conversations.find((item) => item.id === conversationId)?.messages.find((item) => item.id === messageId)?.suggestions?.find((item) => item.id === suggestionId);
  if (!suggestion || suggestion.status !== "pending") throw new AppError("CONFLICT", "建议已处理或不存在，请刷新查看。");
  if (suggestion.kind !== confirmation.kind) throw new AppError("VALIDATION_ERROR", "确认操作与建议不一致。");
  let result: UserGoal | true = true;
  if (suggestion.kind === "goal" && confirmation.kind === "goal") {
    const goals = createGoalStore(overlay);
    const existing = goals.getState().goals.find((item) => item.dimension === suggestion.dimension);
    if (!sameGoal(existing, confirmation.expectedGoal)) throw new AppError("CONFLICT", "目标已发生变化，请取消后重新打开核对。");
    result = goals.upsert(suggestion.dimension, confirmation.intention, confirmation.willingness, confirmation.targetLevel);
  } else if (suggestion.kind === "archive") {
    const profile = createProfileStore(overlay);
    const existing = usableProfileInsights(profile.getState().insights, conversations).find((item) => item.id === suggestion.insightId);
    if (!existing || existing.statement !== suggestion.insightStatement) throw new AppError("CONFLICT", "记忆已发生变化或来源失效，请到我的画像核对。");
    profile.archive(existing.id);
  } else if (suggestion.kind === "outcome" && confirmation.kind === "outcome") {
    const existing = createGoalStore(overlay).getActiveGoals().find((item) => item.id === suggestion.goalId);
    if (!existing || existing.intention !== suggestion.goalIntention) throw new AppError("CONFLICT", "目标已发生变化、暂停或删除，请重新核对。");
    createOutcomeStore(overlay).add(existing, confirmation.action, confirmation.result, confirmation.rating);
  }
  chat.setSuggestionStatus(conversationId, messageId, suggestionId, "completed");
  const previous = new Map([...staged.keys()].map((key) => [key, readStorageItem(storage, key, "无法读取保存前的资料，操作尚未执行。")]));
  const attempted: string[] = [];
  try {
    for (const [key, value] of staged) {
      attempted.push(key);
      storage.setItem(key, value);
    }
  } catch (cause) {
    const failedKey = attempted.at(-1);
    try {
      for (const key of attempted.reverse()) {
        const old = previous.get(key)!;
        if (old === null) storage.removeItem(key);
        else storage.setItem(key, old);
      }
    } catch (rollbackCause) {
      throw new AppError("ROLLBACK_FAILED", "保存失败且回滚未完成，请勿重复确认；到目标、画像或行动记录核对后备份资料。", {
        cause: new AggregateError([cause, rollbackCause], "保存及回滚失败"), operation: "suggestion", storageKey: failedKey,
      });
    }
    const failure = storageError(cause, "write", failedKey, "浏览器存储写入失败。");
    throw new AppError(failure.code, `${failure.message} 已恢复原有资料；建议仍待确认。`, { cause, operation: "suggestion", storageKey: failedKey });
  }
  return result;
}
