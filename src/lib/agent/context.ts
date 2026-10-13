import type { ProfileInsight, UserGoal } from "../../types/cognitive.ts";
import { selectChatContext, serializeChatContext, MAX_CHAT_CONTEXT_CHARACTERS } from "../chat/context.ts";
import { MAX_CHAT_INSIGHTS } from "../profile/context.ts";
import type { PersonalContext, ResponsePreferences } from "../preferences/store.ts";

export function selectAgentContext(task: string, insights: ProfileInsight[], goals: UserGoal[], preferences?: ResponsePreferences, personalContext?: PersonalContext) {
  const selection = selectChatContext([{ role: "user", content: task }], insights, goals, preferences, undefined, personalContext);
  if (selection.profileExcludedByRequest) return selection;
  const learning = /学习|教程|课程|资料|文档|入门|论文|pytorch|python|3dmm|\b(?:learn|tutorial|course|resource|documentation|paper)\b/iu.test(task);
  // Finite rules cover explicit resource preferences and learning prerequisites missed by literal topic matching.
  const constraints = insights.filter((item) => item.status === "confirmed" && item.evidence.length > 0 && (
    item.scope === "preference" && /中文|英文|英语|免费|视频|实践|图文|文档/iu.test(item.statement) ||
    learning && item.dimension === "knowledge_structure" && /中文|英语|英文|视频|免费|实践|基础|入门|编程|python/iu.test(item.statement)
  ));
  const selected: ProfileInsight[] = [];
  for (const item of [...constraints, ...selection.insights]) {
    if (selected.some((existing) => existing.id === item.id)) continue;
    if (selected.length >= MAX_CHAT_INSIGHTS || serializeChatContext([...selected, item], selection.goals, preferences).length > MAX_CHAT_CONTEXT_CHARACTERS) {
      selection.omittedByBudget++;
      continue;
    }
    selected.push({ ...item, evidence: item.evidence.map((source) => ({ ...source })) });
    if (!selection.reasons.some((reason) => reason.kind === "insight" && reason.id === item.id)) {
      selection.reasons.push({ kind: "insight", id: item.id, terms: [], topics: ["资料筛选条件"] });
    }
  }
  selection.insights = selected;
  selection.reasons = selection.reasons.filter((reason) => reason.kind === "goal" || selected.some((item) => item.id === reason.id));
  selection.characters = serializeChatContext(selected, selection.goals, preferences, selection.personalContext).length;
  return selection;
}
