import type { ChatMessage } from "./store.ts";
import type { ProfileInsight, UserGoal } from "../../types/cognitive.ts";
import { MAX_CHAT_INSIGHTS, normalizeProfileStatement } from "../profile/context.ts";
import { matchProfileText, searchTerms } from "../profile/relevance.ts";
import { GOAL_WILLINGNESS_DETAILS } from "../goals/willingness.ts";
import { activePersonalContext, type ResponsePreferences, type PersonalContext } from "../preferences/store.ts";
import { PROFILE_SCOPE_DETAILS } from "../profile/scope.ts";
import { TRAIT_LEVEL_DETAILS } from "../profile/questionnaire.ts";

export const MAX_CHAT_GOALS = 2;
export const MAX_CHAT_CONTEXT_CHARACTERS = 3000;

export interface ContextReferenceReason {
  kind: "insight" | "goal";
  id: string;
  terms: string[];
  topics: string[];
  semanticSimilarity?: number;
}

export interface ChatContextSelection {
  insights: ProfileInsight[];
  goals: UserGoal[];
  reasons: ContextReferenceReason[];
  querySource: "question" | "recent_user_messages";
  characters: number;
  omittedByBudget: number;
  profileExcludedByRequest?: boolean;
  preferences?: ResponsePreferences;
  personalContext?: PersonalContext;
  backgroundExcludedByRequest?: boolean;
  retrieval?: { method: "keyword" | "hybrid"; model?: string; fallbackReason?: string };
}

// Share this serializer with the provider adapter so the budget covers the actual JSON.
export function serializeChatContext(insights: ProfileInsight[], goals: UserGoal[], preferences?: ResponsePreferences, personalContext?: PersonalContext): string {
  const personal = activePersonalContext(personalContext);
  return JSON.stringify({
    confirmedInsights: insights.filter((item) => item.status === "confirmed").map(({ id, dimension, statement, evidence, scope, responseAdaptation, currentLevel }) => ({
      id, dimension, statement, evidence: evidence.map(({ excerpt }) => excerpt),
      sourceKind: evidence.some((source) => source.kind === "questionnaire") ? "questionnaire_self_report" : "conversation",
      ...(evidence.some((source) => source.kind === "questionnaire") ? { questionnaireResponses: evidence.filter((source) => source.kind === "questionnaire").map(({ version, questionId, answer, answeredAt }) => ({ version, questionId, answer, answeredAt })) } : {}),
      ...(currentLevel ? { currentLevel: { value: currentLevel, ...TRAIT_LEVEL_DETAILS[currentLevel] } } : {}),
      ...(scope ? { scope: PROFILE_SCOPE_DETAILS[scope] } : {}),
      responseAdaptation: responseAdaptation ?? "medium",
    })),
    ...(preferences ? { responsePreferences: preferences } : {}),
    ...(personal ? { personalContext: personal } : {}),
    userGoals: goals.filter((item) => item.status === "active").map(({ id, dimension, intention, willingness, targetLevel }) => ({
      id, dimension, intention,
      ...(targetLevel ? { targetLevel: { value: targetLevel, ...TRAIT_LEVEL_DETAILS[targetLevel] } } : {}),
      ...(willingness ? { willingness: GOAL_WILLINGNESS_DETAILS[willingness] } : {}),
    })),
  });
}

function isVagueFollowUp(question: string): boolean {
  const vagueTerms = new Set(["安排", "建议", "步骤", "开始", "接着"]);
  return /那|刚才|上面|这个|那个|这些|接下来|接着|继续|^怎么安排|^如何安排|^what next|^what should|^how should|^continue/iu.test(question) &&
    [...searchTerms(question)].every((term) => vagueTerms.has(term));
}

export function retrievalQuery(history: Pick<ChatMessage, "role" | "content">[]) {
  const latest = history.at(-1)?.content ?? "";
  const previous: Pick<ChatMessage, "role" | "content">[] = [];
  if (isVagueFollowUp(latest)) {
    // Stop at the closest substantive user message; an older topic must not leak in.
    for (let index = history.length - 2; index >= 0 && previous.length < 2; index--) {
      const message = history[index];
      if (message.role !== "user") continue;
      previous.unshift(message);
      if (!isVagueFollowUp(message.content)) break;
    }
  }
  return {
    question: previous.length ? `${previous.map((message) => message.content.slice(-1200)).join("\n")}\n${latest}` : latest,
    source: previous.length ? "recent_user_messages" as const : "question" as const,
  };
}

function selectSupportingEvidence(insight: ProfileInsight): ProfileInsight {
  if (insight.evidence.some((source) => source.kind === "questionnaire")) return { ...insight, evidence: insight.evidence.map((source) => ({ ...source })) };
  const evidence = insight.evidence.map((source, index) => ({ source, index, score: matchProfileText(source.excerpt, insight.statement).score }))
    .sort((a, b) => b.score - a.score || a.index - b.index).slice(0, 2)
    .map(({ source }) => ({ ...source }));
  return { ...insight, evidence };
}

export function selectChatContext(
  history: Pick<ChatMessage, "role" | "content">[],
  insights: ProfileInsight[],
  goals: UserGoal[],
  preferences?: ResponsePreferences,
  semantic?: undefined,
  personalContext?: PersonalContext,
): ChatContextSelection {
  void semantic;
  const query = retrievalQuery(history);
  const selected: ChatContextSelection = { insights: [], goals: [], reasons: [], querySource: query.source, characters: 0, omittedByBudget: 0 };
  if (preferences) selected.preferences = { ...preferences };
  selected.retrieval = { method: "keyword" };
  const latest = history.at(-1);
  const personal = activePersonalContext(personalContext);
  selected.backgroundExcludedByRequest = latest?.role === "user" && /(?:不要|不需要|别)(?:再)?(?:参考|使用|读取|调用)[^。！？\n]{0,12}(?:个人背景|我的背景|背景资料)/u.test(latest.content);
  const appliedPersonal = personal && selected.backgroundExcludedByRequest ? { ...personal, background: "" } : personal;
  const active = activePersonalContext(appliedPersonal);
  if (active) selected.personalContext = active;
  selected.profileExcludedByRequest = latest?.role === "user" &&
    /(?:不要|不需要|别)(?:再)?(?:(?:参考|使用|调用|读取)[^。！？\n]{0,15}|(?:我的|个人|用户)?)(?:画像|个人记忆)/u.test(latest.content);
  const rankedGoals = goals.map((item, index) => ({ item, index, ...matchProfileText(item.intention, query.question) }))
    .filter(({ item, score }) => item.status === "active" && score > 0)
    .sort((a, b) => b.score - a.score || b.index - a.index).slice(0, MAX_CHAT_GOALS);

  // Reserve room for relevant user goals before adding background descriptions.
  for (const match of rankedGoals) {
    if (serializeChatContext(selected.insights, [...selected.goals, match.item], preferences).length > MAX_CHAT_CONTEXT_CHARACTERS) {
      selected.omittedByBudget++;
      continue;
    }
    selected.goals.push({ ...match.item });
    selected.reasons.push({ kind: "goal", id: match.item.id, terms: match.terms.slice(0, 3), topics: match.topics });
  }

  const seen = new Set<string>();
  const rankedInsights = (selected.profileExcludedByRequest ? [] : insights)
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.status === "confirmed" && item.evidence.length > 0)
    .map(({ item, index }) => ({ item, index, ...matchProfileText(item.statement, query.question) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.index - a.index);
  for (const match of rankedInsights) {
    const key = `${match.item.dimension}:${normalizeProfileStatement(match.item.statement)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const item = selectSupportingEvidence(match.item);
    if (selected.insights.length >= MAX_CHAT_INSIGHTS || serializeChatContext([...selected.insights, item], selected.goals, preferences).length > MAX_CHAT_CONTEXT_CHARACTERS) {
      selected.omittedByBudget++;
      continue;
    }
    selected.insights.push(item);
    selected.reasons.push({ kind: "insight", id: item.id, terms: match.terms.slice(0, 3), topics: match.topics });
  }
  // Memory selection retains its original budget; free text has separate field limits.
  selected.characters = serializeChatContext(selected.insights, selected.goals, preferences, selected.personalContext).length;
  return selected;
}
