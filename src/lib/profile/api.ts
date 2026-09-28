import type { Conversation } from "../chat/store.ts";
import { COGNITIVE_DIMENSIONS } from "../../types/cognitive.ts";
import type { ProfileInsight } from "../../types/cognitive.ts";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recentMessages(conversation: Conversation) {
  const selected: { id: string; role: "user" | "assistant"; content: string }[] = [];
  let characters = 0;
  for (let index = conversation.messages.length - 1; index >= 0 && selected.length < 20; index--) {
    const { id, role, content } = conversation.messages[index];
    if (characters + content.length > 20000) break;
    selected.unshift({ id, role, content });
    characters += content.length;
  }
  return selected;
}

export async function requestProfileCandidates(
  conversation: Conversation,
  fetcher: (input: string, init?: RequestInit) => Promise<Response> = fetch,
): Promise<ProfileInsight[]> {
  const messages = recentMessages(conversation);
  if (!messages.some((message) => message.role === "user")) {
    throw new Error("这段对话还没有可分析的用户消息。");
  }
  let response: Response;
  try {
    response = await fetcher("/api/profile/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: conversation.id, messages }),
      signal: AbortSignal.timeout(35000),
    });
  } catch {
    throw new Error("无法连接画像提取服务，请稍后重试。");
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("画像提取服务返回了无法读取的结果。");
  }
  if (!response.ok) {
    const error = record(body) ? body.error : null;
    const message = record(error) ? error.message : null;
    throw new Error(typeof message === "string" ? message : "画像提取失败，请稍后重试。");
  }
  const data = record(body) ? body.data : null;
  const candidates = record(data) ? data.candidates : null;
  if (!Array.isArray(candidates) || candidates.length > 3) {
    throw new Error("画像候选数据格式无效。");
  }
  for (const item of candidates) {
    if (!record(item) || typeof item.id !== "string" ||
        !COGNITIVE_DIMENSIONS.some((dimension) => dimension === item.dimension) ||
        typeof item.statement !== "string" || !item.statement.trim() ||
        item.origin !== "ai_inference" || item.status !== "candidate" ||
        !Array.isArray(item.evidence) || item.evidence.length < 1) {
      throw new Error("画像候选数据格式无效。");
    }
    for (const evidence of item.evidence) {
      if (!record(evidence) || evidence.conversationId !== conversation.id ||
          typeof evidence.messageId !== "string" || typeof evidence.excerpt !== "string" ||
          !evidence.excerpt.trim()) {
        throw new Error("画像证据与原对话不匹配。");
      }
      const source = messages.find((message) =>
        message.id === evidence.messageId && message.role === "user"
      );
      if (!source || !source.content.includes(evidence.excerpt)) {
        throw new Error("画像证据与原对话不匹配。");
      }
    }
  }
  return candidates as ProfileInsight[];
}
