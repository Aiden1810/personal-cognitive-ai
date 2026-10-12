import type { EvidenceReference, CognitiveDimension } from "../../types/cognitive.ts";
import type { Conversation } from "../chat/store.ts";
import { isQuestionnaireAnswer, questionnaireExcerpt, QUESTIONNAIRE_QUESTIONS } from "./questionnaire.ts";

export function isEvidenceReference(value: unknown, dimension?: CognitiveDimension): value is EvidenceReference {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const source = value as Record<string, unknown>;
  if (typeof source.excerpt !== "string" || !source.excerpt.trim() || source.excerpt.length > 500) return false;
  if (source.kind === "questionnaire") {
    const question = QUESTIONNAIRE_QUESTIONS.find((item) => item.id === source.questionId);
    return !!question && (dimension === undefined || question.dimension === dimension) &&
      source.version === 1 && isQuestionnaireAnswer(source.answer) &&
      typeof source.answeredAt === "string" && source.answeredAt.length <= 50 && !Number.isNaN(Date.parse(source.answeredAt)) &&
      source.excerpt === questionnaireExcerpt(question.id, source.answer);
  }
  return (source.kind === undefined || source.kind === "chat") &&
    typeof source.conversationId === "string" && source.conversationId.trim().length > 0 && source.conversationId.length <= 100 &&
    typeof source.messageId === "string" && source.messageId.trim().length > 0 && source.messageId.length <= 100;
}

export function evidenceKey(source: EvidenceReference): string {
  return source.kind === "questionnaire" ? `${source.questionId}:${source.answeredAt}:${source.answer}` : `${source.conversationId}:${source.messageId}:${source.excerpt}`;
}

export function evidenceTitle(source: EvidenceReference, conversations: Conversation[]): string {
  return source.kind === "questionnaire" ? "初始问卷 · 最近四周的学习或项目自述" :
    conversations.find((conversation) => conversation.id === source.conversationId)?.title ?? "原对话已删除";
}

export function evidenceDate(source: EvidenceReference, conversations: Conversation[]): string | undefined {
  return source.kind === "questionnaire" ? source.answeredAt :
    conversations.find((conversation) => conversation.id === source.conversationId)?.messages.find((message) => message.id === source.messageId)?.createdAt;
}
