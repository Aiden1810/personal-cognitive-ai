import { GOAL_WILLINGNESS_LEVELS, type GoalWillingness } from "../../types/cognitive.ts";

export const GOAL_WILLINGNESS_DETAILS: Record<GoalWillingness, { label: string; description: string }> = {
  not_now: { label: "暂不想改变", description: "先保留这个方向，目前不主动推动改变。" },
  slight: { label: "稍微想改变", description: "愿意了解建议，先尝试一点。" },
  moderate: { label: "比较想改变", description: "愿意尝试一个小步骤，再看是否适合。" },
  strong: { label: "很想改变", description: "希望制定具体计划，持续尝试。" },
  highest: { label: "当前最想改变", description: "这是当前最想推进的方向，希望优先安排。" },
};

export function isGoalWillingness(value: unknown): value is GoalWillingness {
  return GOAL_WILLINGNESS_LEVELS.some((level) => level === value);
}
