export const COGNITIVE_DIMENSIONS = [
  "personality",
  "cognitive_architecture",
  "values_and_beliefs",
  "behavioral_patterns",
  "knowledge_structure",
  "social_relations",
  "narrative_self",
] as const;

export type CognitiveDimension = (typeof COGNITIVE_DIMENSIONS)[number];

export interface EvidenceReference {
  conversationId: string;
  messageId: string;
  excerpt: string;
}

export interface ProfileInsight {
  id: string;
  dimension: CognitiveDimension;
  statement: string;
  origin: "user_statement" | "ai_inference";
  status: "candidate" | "confirmed" | "rejected";
  evidence: EvidenceReference[];
}

export interface ProfileConflict {
  id: string;
  insightIds: [string, string];
  status: "open" | "resolved";
}

export interface UserGoal {
  id: string;
  dimension: CognitiveDimension;
  intention: string;
  status: "active" | "paused";
}
