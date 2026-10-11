import type { ProfileInsight, ProfileScope } from "../../types/cognitive.ts";

export const PROFILE_SCOPE_DETAILS = {
  event: { label: "一次经历", note: "描述这次经历，不能据此认定长期习惯。" },
  current_state: { label: "近期状态", note: "可能随时间变化，回答时应核对是否仍适用。" },
  preference: { label: "自述偏好", note: "来自你表达的偏好，可以随时修正。" },
  pattern: { label: "自述习惯", note: "你描述的反复行为，不等于系统观察或测量的结论。" },
} as const;

export function isProfileScope(value: unknown): value is ProfileScope {
  return typeof value === "string" && Object.hasOwn(PROFILE_SCOPE_DETAILS, value);
}

const recurring = /经常|每次|一直|通常|习惯|总是|反复|一贯|长期|\boften\b|\busually\b|\balways\b|\bhabit\b/iu;

// A conservative text guard; semantic accuracy still requires the user's review.
export function candidateScope(value: unknown, statement: string, evidence: ProfileInsight["evidence"]): ProfileScope | null {
  if (value !== undefined && !isProfileScope(value)) return null;
  const scope = value ?? "event";
  const reportedRecurrence = evidence.some((source) => recurring.test(source.excerpt));
  if ((scope === "pattern" || recurring.test(statement)) && !reportedRecurrence) return null;
  return scope as ProfileScope;
}
