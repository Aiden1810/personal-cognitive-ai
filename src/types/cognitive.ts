export const TRAIT_DIMENSIONS = ["action_execution", "planning", "time_management", "reflection", "exploration"] as const;
export type TraitDimension = (typeof TRAIT_DIMENSIONS)[number];

export const LEGACY_DIMENSIONS = [
  "personality",
  "cognitive_architecture",
  "values_and_beliefs",
  "behavioral_patterns",
  "knowledge_structure",
  "social_relations",
  "narrative_self",
] as const;

// Existing background records stay readable; they are not silently reclassified.
export const COGNITIVE_DIMENSIONS = [...TRAIT_DIMENSIONS, ...LEGACY_DIMENSIONS] as const;

export type CognitiveDimension = (typeof COGNITIVE_DIMENSIONS)[number];

export interface ChatEvidenceReference {
  kind?: "chat";
  conversationId: string;
  messageId: string;
  excerpt: string;
}

export type QuestionnaireAnswer = "rare" | "sometimes" | "often" | "unsure" | "not_applicable";
export type TraitLevel = "low" | "medium" | "high" | "varied" | "unknown";
export interface QuestionnaireEvidenceReference {
  kind: "questionnaire";
  version: 1;
  questionId: string;
  answer: QuestionnaireAnswer;
  answeredAt: string;
  excerpt: string;
}
export type EvidenceReference = ChatEvidenceReference | QuestionnaireEvidenceReference;

export interface ProfileInsight {
  id: string;
  dimension: CognitiveDimension;
  statement: string;
  origin: "user_statement" | "ai_inference";
  status: "candidate" | "confirmed" | "rejected" | "archived";
  // Older records remain unclassified until the user reviews their scope.
  scope?: ProfileScope;
  // User-controlled response support, separate from the truth of this record.
  responseAdaptation?: ResponseAdaptation;
  // Reviewed user self-assessment, separate from response support or confidence.
  currentLevel?: TraitLevel;
  evidence: EvidenceReference[];
}

export type ProfileScope = "event" | "current_state" | "preference" | "pattern";
export type ResponseAdaptation = "low" | "medium" | "high";

export interface ProfileConflict {
  id: string;
  insightIds: [string, string];
  status: "open" | "resolved";
}

export const GOAL_WILLINGNESS_LEVELS = ["not_now", "slight", "moderate", "strong", "highest"] as const;
export type GoalWillingness = (typeof GOAL_WILLINGNESS_LEVELS)[number];

export interface UserGoal {
  id: string;
  dimension: CognitiveDimension;
  intention: string;
  // User-selected willingness; omitted for older goals or when not set.
  willingness?: GoalWillingness;
  targetLevel?: TraitLevel;
  status: "active" | "paused";
}
