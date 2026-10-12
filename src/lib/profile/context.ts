import type { Conversation } from "../chat/store.ts";
import type { ProfileInsight } from "../../types/cognitive.ts";
import { matchProfileText, type RelevanceMatch } from "./relevance.ts";

export const MAX_CHAT_INSIGHTS = 5;
export const MAX_EXISTING_INSIGHTS = 30;
export type ExistingInsight = Pick<ProfileInsight, "dimension" | "statement" | "status">;

export function normalizeProfileStatement(statement: string): string {
  return statement.normalize("NFKC").trim().toLowerCase()
    .replace(/\s+/gu, " ").replace(/[。.！!]+$/u, "");
}

export function rankChatInsights(insights: ProfileInsight[], question: string) {
  return insights.map((item, index) => ({ item, index }))
    .filter(({ item }) => item.status === "confirmed" && item.evidence.length > 0)
    .map(({ item, index }) => {
      // Evidence supports a statement; incidental topics in a quote are not a separate profile.
      const match: RelevanceMatch = matchProfileText(item.statement, question);
      return { item, index, ...match };
    })
    .filter(({ score }) => score > 0)
    // 同分时优先后添加的记录；不改写本地数组或审核状态。
    .sort((a, b) => b.score - a.score || b.index - a.index);
}

export function selectChatInsights(insights: ProfileInsight[], question: string): ProfileInsight[] {
  return rankChatInsights(insights, question).slice(0, MAX_CHAT_INSIGHTS).map(({ item }) => item);
}

export function getExtractionContext(conversation: Conversation | null, insights: ProfileInsight[] = []) {
  const userMessages = (conversation?.messages ?? []).filter((message) => message.role === "user");
  const messages: Pick<Conversation["messages"][number], "id" | "role" | "content">[] = [];
  let characters = 0;
  for (let index = userMessages.length - 1; index >= 0 && messages.length < 20; index--) {
    const { id, role, content } = userMessages[index];
    if (characters + content.length > 20000) break;
    messages.unshift({ id, role, content });
    characters += content.length;
  }
  const existingInsights: ExistingInsight[] = insights.filter((item) =>
    item.evidence.some((source) => source.kind !== "questionnaire" && source.conversationId === conversation?.id &&
      messages.some((message) => message.id === source.messageId && message.content.includes(source.excerpt)))
  ).slice(-MAX_EXISTING_INSIGHTS).map(({ dimension, statement, status }) => ({ dimension, statement, status }));
  return {
    messages,
    existingInsights,
    totalUserMessages: userMessages.length,
    omittedUserMessages: userMessages.length - messages.length,
  };
}
