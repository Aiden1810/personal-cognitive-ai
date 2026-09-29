import type { Conversation } from "../chat/store.ts";
import type { ProfileInsight } from "../../types/cognitive.ts";

export function hasIntactProfileEvidence(
  insight: ProfileInsight,
  conversations: Conversation[],
): boolean {
  return insight.evidence.length > 0 &&
    insight.evidence.every((source) => {
      const conversation = conversations.find((item) => item.id === source.conversationId);
      const message = conversation?.messages.find((item) => item.id === source.messageId);
      return message?.role === "user" && message.content.includes(source.excerpt);
    });
}

export function usableProfileInsights(
  insights: ProfileInsight[],
  conversations: Conversation[],
): ProfileInsight[] {
  return insights.filter((insight) =>
    insight.status === "confirmed" && hasIntactProfileEvidence(insight, conversations)
  );
}
