import { COGNITIVE_DIMENSIONS } from "../../types/cognitive.ts";
import type { CognitiveDimension, ProfileInsight } from "../../types/cognitive.ts";
import type { Conversation } from "../chat/store.ts";
import { hasIntactProfileEvidence } from "./usable.ts";
import { TRAIT_DETAILS } from "./questionnaire.ts";

export const PROFILE_DIMENSIONS: Record<CognitiveDimension, { label: string; description: string }> = {
  ...TRAIT_DETAILS,
  personality: { label: "性格与倾向", description: "你描述的做事倾向，例如做决定前会先核对依据。一次表现不代表长期性格。" },
  cognitive_architecture: { label: "学习与思考", description: "什么方法对你有用，例如先做题再整理笔记，或通过例子理解概念。" },
  values_and_beliefs: { label: "重视的事情", description: "选择时你更看重什么，例如按时交付、独立思考或与人合作。" },
  behavioral_patterns: { label: "行动与习惯", description: "记录做过的事和你自述的习惯，例如上次截止前加功能导致延期。" },
  knowledge_structure: { label: "知识与背景", description: "你熟悉什么、正在学习什么，例如掌握 Python 基础，正在学习前端。" },
  social_relations: { label: "合作与沟通", description: "你习惯怎样与人协作，例如先明确分工，再一起核对进度。" },
  narrative_self: { label: "经历与自我认识", description: "你怎样看待自己的经历，例如一次比赛失利后，开始重视先完成核心流程。" },
};

export interface ProfileDimensionGroup {
  dimension: CognitiveDimension;
  active: ProfileInsight[];
  pending: ProfileInsight[];
  rejected: ProfileInsight[];
  invalid: ProfileInsight[];
  archived: ProfileInsight[];
}

export function buildProfileOverview(
  insights: ProfileInsight[],
  conversations: Conversation[],
): ProfileDimensionGroup[] {
  return COGNITIVE_DIMENSIONS.map((dimension) => {
    const group: ProfileDimensionGroup = {
      dimension, active: [], pending: [], rejected: [], invalid: [], archived: [],
    };
    for (const insight of insights) {
      if (insight.dimension !== dimension) continue;
      if (!hasIntactProfileEvidence(insight, conversations)) group.invalid.push(insight);
      else if (insight.status === "confirmed") group.active.push(insight);
      else if (insight.status === "candidate") group.pending.push(insight);
      else if (insight.status === "archived") group.archived.push(insight);
      else group.rejected.push(insight);
    }
    return group;
  });
}
