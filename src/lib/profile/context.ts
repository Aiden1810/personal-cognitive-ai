import type { Conversation } from "../chat/store.ts";
import type { ProfileInsight } from "../../types/cognitive.ts";

export const MAX_CHAT_INSIGHTS = 20;
export const MAX_EXISTING_INSIGHTS = 30;
export type ExistingInsight = Pick<ProfileInsight, "dimension" | "statement" | "status">;

export function normalizeProfileStatement(statement: string): string {
  return statement.normalize("NFKC").trim().toLowerCase()
    .replace(/\s+/gu, " ").replace(/[。.！!]+$/u, "");
}

function searchTerms(value: string): Set<string> {
  const terms = new Set<string>();
  for (const part of value.normalize("NFKC").toLowerCase().match(/[\p{Script=Han}]+|[a-z0-9]+/gu) ?? []) {
    if (/\p{Script=Han}/u.test(part)) {
      // 中文按相邻两字匹配；这是轻量字面匹配，不是语义检索。
      for (let index = 0; index < part.length - 1; index++) terms.add(part.slice(index, index + 2));
    } else {
      terms.add(part);
    }
  }
  return terms;
}

export function selectChatInsights(insights: ProfileInsight[], question: string): ProfileInsight[] {
  const terms = searchTerms(question);
  return insights.map((item, index) => ({ item, index }))
    .filter(({ item }) => item.status === "confirmed")
    .map(({ item, index }) => {
      const matches = searchTerms(`${item.statement} ${item.evidence.map((source) => source.excerpt).join(" ")}`);
      const score = [...terms].filter((term) => matches.has(term)).length;
      return { item, index, score };
    })
    // 同分时优先后添加的记录；不改写本地数组或审核状态。
    .sort((a, b) => b.score - a.score || b.index - a.index)
    .slice(0, MAX_CHAT_INSIGHTS)
    .map(({ item }) => item);
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
    item.evidence.some((source) => source.conversationId === conversation?.id &&
      messages.some((message) => message.id === source.messageId && message.content.includes(source.excerpt)))
  ).slice(-MAX_EXISTING_INSIGHTS).map(({ dimension, statement, status }) => ({ dimension, statement, status }));
  return {
    messages,
    existingInsights,
    totalUserMessages: userMessages.length,
    omittedUserMessages: userMessages.length - messages.length,
  };
}
