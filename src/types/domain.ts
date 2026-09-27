export const CONTRACT_VERSION = "0.1" as const;
export const DEMO_USER_ID = "demo-user";

export interface BaseRecord {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export type ReviewStatus = "pending" | "confirmed" | "rejected";

export interface DecisionCase extends BaseRecord {
  title: string;
  context: string;
  scenario: string;
  options: string[];
  constraints: string[];
  actualChoice: string;
  outcome: string | null;
  occurredAt: string | null;
  sourceType: "self_report" | "observed" | "demo";
  sourceNote: string;
  sourceRef: string | null;
  status: ReviewStatus;
}

export interface BehaviorPattern extends BaseRecord {
  description: string;
  scenario: string;
  supportCaseIds: string[];
  counterCaseIds: string[];
  caveats: string[];
  status: ReviewStatus;
  userNote: string | null;
}

export interface ImprovementGoal extends BaseRecord {
  patternId: string | null;
  description: string;
  scenario: string;
  applicability: string;
  status: "active" | "inactive";
}

export interface CurrentDecision {
  question: string;
  scenario: string;
  options: string[];
  constraints: string[];
}

export interface PerspectiveAnswer {
  perspective: "generic" | "original" | "better";
  status: "ready" | "insufficient_evidence";
  summary: string;
  reasoning: string;
  evidenceCaseIds: string[];
  goalId: string | null;
  ruleIds: string[];
  caveats: string[];
}

export interface DecisionComparison extends BaseRecord {
  currentDecision: CurrentDecision;
  generic: PerspectiveAnswer;
  original: PerspectiveAnswer;
  better: PerspectiveAnswer;
  generationSource: "live" | "example";
  modelId: string | null;
  contractVersion: typeof CONTRACT_VERSION;
  rulesVersion: string | null;
  evidenceSnapshot: DecisionCase[];
  patternSnapshot: BehaviorPattern[];
  goalSnapshot: ImprovementGoal | null;
}

export interface DecisionFeedback extends BaseRecord {
  comparisonId: string;
  actualChoice: string;
  recordedAt: string;
  outcome: string | null;
  outcomeRecordedAt: string | null;
  userNote: string | null;
}

export interface DemoState {
  contractVersion: typeof CONTRACT_VERSION;
  cases: DecisionCase[];
  patterns: BehaviorPattern[];
  goals: ImprovementGoal[];
  comparisons: DecisionComparison[];
  feedback: DecisionFeedback[];
}
