import { COGNITIVE_DIMENSIONS, type CognitiveDimension, type ProfileInsight, type UserGoal } from "../../types/cognitive.ts";

interface SuggestionReason {
  reason: string;
  excerpt: string;
}

export type ChatActionDraft = SuggestionReason & (
  | { kind: "goal"; dimension: CognitiveDimension; intention: string }
  | { kind: "archive"; insightId: string; insightStatement: string }
  | { kind: "outcome"; goalId: string; goalIntention: string; action: string; result: string }
);

export type ChatSuggestion = ChatActionDraft & {
  id: string;
  sourceMessageId: string;
  status: "pending" | "dismissed" | "completed";
};

export interface SuggestionContext {
  question: string;
  insights: ProfileInsight[];
  goals: UserGoal[];
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum;
}

export function isChatActionDraft(value: unknown): value is ChatActionDraft {
  if (!record(value) || !text(value.reason, 300) || !text(value.excerpt, 500)) return false;
  if (value.kind === "goal") return COGNITIVE_DIMENSIONS.some((item) => item === value.dimension) && text(value.intention, 500);
  if (value.kind === "archive") return text(value.insightId, 100) && text(value.insightStatement, 500);
  return value.kind === "outcome" && text(value.goalId, 100) && text(value.goalIntention, 500) &&
    text(value.action, 500) && typeof value.result === "string" && value.result.length <= 1000;
}

export function isChatSuggestion(value: unknown): value is ChatSuggestion {
  return record(value) && isChatActionDraft(value) && text(value.id, 100) && text(value.sourceMessageId, 100) &&
    typeof value.status === "string" && ["pending", "dismissed", "completed"].includes(value.status);
}

// Model text is untrusted: references must come from the context, quotes from this user turn.
export function parseSuggestedActions(value: unknown, context: SuggestionContext): ChatActionDraft[] {
  if (!record(value) || !["suggestedGoal", "suggestedArchive", "suggestedOutcome"].some((key) => key in value)) {
    throw new Error("AI 的结构化建议无效。");
  }
  const actions: ChatActionDraft[] = [];
  for (const kind of ["goal", "archive", "outcome"] as const) {
    const item = value[{ goal: "suggestedGoal", archive: "suggestedArchive", outcome: "suggestedOutcome" }[kind]];
    if (!record(item) || !text(item.reason, 300) || !text(item.excerpt, 500) || !context.question.includes(item.excerpt.trim())) continue;
    const base = { reason: item.reason.trim(), excerpt: item.excerpt.trim() };
    if (kind === "goal" && COGNITIVE_DIMENSIONS.some((dimension) => dimension === item.dimension) && text(item.intention, 500)) {
      actions.push({ ...base, kind, dimension: item.dimension as CognitiveDimension, intention: item.intention.trim() });
    } else if (kind === "archive") {
      const insight = context.insights.find((existing) => existing.id === item.insightId && existing.status === "confirmed" && existing.evidence.length > 0);
      if (insight) actions.push({ ...base, kind, insightId: insight.id, insightStatement: insight.statement });
    } else if (kind === "outcome" && text(item.action, 500) &&
      (item.result === undefined || (typeof item.result === "string" && item.result.length <= 1000))) {
      const goal = context.goals.find((existing) => existing.id === item.goalId && existing.status === "active");
      if (goal) actions.push({ ...base, kind, goalId: goal.id, goalIntention: goal.intention, action: item.action.trim(), result: typeof item.result === "string" ? item.result.trim() : "" });
    }
  }
  return actions;
}

export function bindChatSuggestions(actions: ChatActionDraft[], sourceMessageId: string): ChatSuggestion[] {
  return actions.map((action) => ({ ...action, id: crypto.randomUUID(), sourceMessageId, status: "pending" }));
}
