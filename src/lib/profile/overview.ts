import { COGNITIVE_DIMENSIONS } from "../../types/cognitive.ts";
import type { CognitiveDimension, ProfileInsight } from "../../types/cognitive.ts";
import type { Conversation } from "../chat/store.ts";
import { hasIntactProfileEvidence } from "./usable.ts";

export const PROFILE_DIMENSIONS: Record<CognitiveDimension, { label: string; description: string }> = {
  personality: { label: "人格特质", description: "相对稳定的特点与动机" },
  cognitive_architecture: { label: "认知架构", description: "思考、学习和做决定的方式" },
  values_and_beliefs: { label: "价值观与信念", description: "重视的事情与判断依据" },
  behavioral_patterns: { label: "行为模式", description: "反复出现的行动方式" },
  knowledge_structure: { label: "知识结构", description: "熟悉的领域和知识组织方式" },
  social_relations: { label: "社会关系", description: "与人合作和建立信任的方式" },
  narrative_self: { label: "叙事自我", description: "对自己的描述与重要经历" },
};

export interface ProfileDimensionGroup {
  dimension: CognitiveDimension;
  active: ProfileInsight[];
  pending: ProfileInsight[];
  rejected: ProfileInsight[];
  invalid: ProfileInsight[];
}

export function buildProfileOverview(
  insights: ProfileInsight[],
  conversations: Conversation[],
): ProfileDimensionGroup[] {
  return COGNITIVE_DIMENSIONS.map((dimension) => {
    const group: ProfileDimensionGroup = {
      dimension, active: [], pending: [], rejected: [], invalid: [],
    };
    for (const insight of insights) {
      if (insight.dimension !== dimension) continue;
      if (!hasIntactProfileEvidence(insight, conversations)) group.invalid.push(insight);
      else if (insight.status === "confirmed") group.active.push(insight);
      else if (insight.status === "candidate") group.pending.push(insight);
      else group.rejected.push(insight);
    }
    return group;
  });
}
