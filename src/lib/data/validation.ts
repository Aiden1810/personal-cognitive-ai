import { CONTRACT_VERSION, DEMO_USER_ID } from "../../types/domain.ts";
import type {
  BaseRecord,
  BehaviorPattern,
  CurrentDecision,
  DecisionCase,
  DecisionComparison,
  DecisionFeedback,
  DemoState,
  ImprovementGoal,
  PerspectiveAnswer,
} from "../../types/domain.ts";

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): value is ObjectValue =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
const nullableText = (value: unknown): boolean =>
  value === null || typeof value === "string";
const texts = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(text);
const time = (value: unknown): boolean =>
  text(value) &&
  /(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
  Number.isFinite(Date.parse(value));
const nullableTime = (value: unknown): boolean => value === null || time(value);
const review = (value: unknown): boolean =>
  ["pending", "confirmed", "rejected"].includes(value as string);

function base(value: unknown): value is BaseRecord & ObjectValue {
  return (
    object(value) &&
    text(value.id) &&
    value.userId === DEMO_USER_ID &&
    time(value.createdAt) &&
    time(value.updatedAt)
  );
}

export function isDecisionCase(value: unknown): value is DecisionCase {
  return (
    base(value) &&
    text(value.title) &&
    text(value.context) &&
    text(value.scenario) &&
    texts(value.options) &&
    texts(value.constraints) &&
    text(value.actualChoice) &&
    nullableText(value.outcome) &&
    nullableTime(value.occurredAt) &&
    ["self_report", "observed", "demo"].includes(value.sourceType as string) &&
    text(value.sourceNote) &&
    nullableText(value.sourceRef) &&
    review(value.status)
  );
}

export function isBehaviorPattern(value: unknown): value is BehaviorPattern {
  return (
    base(value) &&
    text(value.description) &&
    text(value.scenario) &&
    texts(value.supportCaseIds) &&
    texts(value.counterCaseIds) &&
    texts(value.caveats) &&
    review(value.status) &&
    nullableText(value.userNote)
  );
}

export function isImprovementGoal(value: unknown): value is ImprovementGoal {
  return (
    base(value) &&
    nullableText(value.patternId) &&
    text(value.description) &&
    text(value.scenario) &&
    text(value.applicability) &&
    ["active", "inactive"].includes(value.status as string)
  );
}

function currentDecision(value: unknown): value is CurrentDecision {
  return (
    object(value) &&
    text(value.question) &&
    text(value.scenario) &&
    texts(value.options) &&
    texts(value.constraints)
  );
}

function answer(value: unknown): value is PerspectiveAnswer {
  return (
    object(value) &&
    ["generic", "original", "better"].includes(value.perspective as string) &&
    ["ready", "insufficient_evidence"].includes(value.status as string) &&
    text(value.summary) &&
    text(value.reasoning) &&
    texts(value.evidenceCaseIds) &&
    nullableText(value.goalId) &&
    texts(value.ruleIds) &&
    texts(value.caveats)
  );
}

export function isDecisionComparison(
  value: unknown,
): value is DecisionComparison {
  if (
    !base(value) ||
    !currentDecision(value.currentDecision) ||
    !answer(value.generic) ||
    !answer(value.original) ||
    !answer(value.better) ||
    !["live", "example"].includes(value.generationSource as string) ||
    !nullableText(value.modelId) ||
    value.contractVersion !== CONTRACT_VERSION ||
    !nullableText(value.rulesVersion) ||
    !Array.isArray(value.evidenceSnapshot) ||
    !value.evidenceSnapshot.every(isDecisionCase) ||
    !Array.isArray(value.patternSnapshot) ||
    !value.patternSnapshot.every(isBehaviorPattern) ||
    !(value.goalSnapshot === null || isImprovementGoal(value.goalSnapshot))
  )
    return false;

  const generic = value.generic;
  const original = value.original;
  const better = value.better;
  const evidence = value.evidenceSnapshot;
  const goal = value.goalSnapshot;
  const decision = value.currentDecision;
  return (
    generic.perspective === "generic" &&
    generic.evidenceCaseIds.length === 0 &&
    generic.goalId === null &&
    generic.ruleIds.length === 0 &&
    original.perspective === "original" &&
    original.goalId === null &&
    better.perspective === "better" &&
    (value.generationSource === "example"
      ? value.modelId === null
      : text(value.modelId)) &&
    evidence.every(
      (item) =>
        item.status === "confirmed" && item.scenario === decision.scenario,
    ) &&
    value.patternSnapshot.every(
      (item) =>
        item.status === "confirmed" && item.scenario === decision.scenario,
    ) &&
    [original, better].every((item) =>
      item.evidenceCaseIds.every((id) =>
        evidence.some((entry) => entry.id === id),
      ),
    ) &&
    (better.goalId === null
      ? better.status === "insufficient_evidence" && goal === null
      : goal !== null &&
        goal.status === "active" &&
        goal.id === better.goalId &&
        goal.scenario === decision.scenario)
  );
}

export function isDecisionFeedback(value: unknown): value is DecisionFeedback {
  return (
    base(value) &&
    text(value.comparisonId) &&
    text(value.actualChoice) &&
    time(value.recordedAt) &&
    nullableText(value.outcome) &&
    nullableTime(value.outcomeRecordedAt) &&
    nullableText(value.userNote)
  );
}

function records<T extends BaseRecord>(
  value: unknown,
  valid: (item: unknown) => item is T,
): value is T[] {
  return (
    Array.isArray(value) &&
    value.every(valid) &&
    new Set(value.map((item) => item.id)).size === value.length
  );
}

export function isDemoState(value: unknown): value is DemoState {
  return (
    object(value) &&
    value.contractVersion === CONTRACT_VERSION &&
    records(value.cases, isDecisionCase) &&
    records(value.patterns, isBehaviorPattern) &&
    records(value.goals, isImprovementGoal) &&
    records(value.comparisons, isDecisionComparison) &&
    records(value.feedback, isDecisionFeedback)
  );
}
