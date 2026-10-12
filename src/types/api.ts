import type {
  BehaviorPattern,
  CurrentDecision,
  DecisionCase,
  DecisionComparison,
  ImprovementGoal,
} from "./domain";

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "MISSING_ACTIVE_GOAL"
  | "LLM_UNAVAILABLE"
  | "INVALID_MODEL_OUTPUT"
  | "INTERNAL_ERROR";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ApiErrorCode; message: string } };

// Contracts for the next task. No API routes exist in the foundation.
export interface AnalyzePatternsRequest {
  scenario: string;
  cases: DecisionCase[];
}

export type AnalyzePatternsResponse = ApiResult<BehaviorPattern[]>;

export interface CompareDecisionsRequest {
  currentDecision: CurrentDecision;
  cases: DecisionCase[];
  patterns: BehaviorPattern[];
  goal: ImprovementGoal;
}

export type CompareDecisionsResponse = ApiResult<DecisionComparison>;
