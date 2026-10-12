import type { ChatMessage } from "./store.ts";
import type { ProfileInsight, UserGoal } from "../../types/cognitive.ts";
import { retrievalQuery, selectChatContext, type ChatContextSelection } from "./context.ts";
import type { ResponsePreferences, PersonalContext } from "../preferences/store.ts";
import { requestSemanticMatches } from "../retrieval/api.ts";
import { AppError } from "../errors.ts";
import { CHAT_API_ERROR_CODES, type ChatApiErrorCode, type ChatRequest, type ChatResponse } from "../../types/chat-api.ts";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseChatResponse(value: unknown, status: number): ChatResponse {
  const error = record(value) && record(value.error) ? value.error : null;
  if (record(value) && value.ok === false && error &&
      CHAT_API_ERROR_CODES.some((code) => code === error.code) &&
      typeof error.message === "string" && error.message.trim()) {
    return { ok: false, error: { code: error.code as ChatApiErrorCode, message: error.message } };
  }
  if (record(value) && value.ok === true) {
    const reply = record(value.data) ? value.data.reply : null;
    if (typeof reply === "string" && reply.trim()) return { ok: true, data: { reply: reply.trim() } };
    throw new AppError("INVALID_RESPONSE", "聊天服务没有返回可用的回复。", { status });
  }
  throw new AppError("INVALID_RESPONSE", "聊天服务返回了无法读取的结果。", { status });
}

function recentMessages(history: ChatMessage[]) {
  const selected: Pick<ChatMessage, "role" | "content">[] = [];
  let characters = 0;
  for (let index = history.length - 1; index >= 0 && selected.length < 30; index--) {
    const { role, content } = history[index];
    if (characters + content.length > 40000) break;
    selected.unshift({ role, content });
    characters += content.length;
  }
  return selected;
}

export async function requestAssistantReply(
  history: ChatMessage[],
  insights: ProfileInsight[] = [],
  goals: UserGoal[] = [],
  fetcher: (input: string, init?: RequestInit) => Promise<Response> = fetch,
  onContextSelected?: (selection: ChatContextSelection) => void,
  preferences?: ResponsePreferences,
  semanticEnabled = false,
  personalContext?: PersonalContext,
): Promise<string> {
  if (history.length === 0 || history.at(-1)?.role !== "user") {
    throw new AppError("VALIDATION_ERROR", "请先发送一条用户消息。");
  }
  const messages = recentMessages(history);
  let selection = selectChatContext(messages, insights, goals, preferences, undefined, personalContext);
  if (semanticEnabled && (insights.length > 0 || goals.length > 0)) {
    try {
      const scores = await requestSemanticMatches(retrievalQuery(messages).question,
        selection.profileExcludedByRequest ? [] : insights, goals, fetcher);
      selection = selectChatContext(messages, insights, goals, preferences, scores, personalContext);
    } catch (error) {
      selection.retrieval = { method: "keyword", fallbackReason: error instanceof Error ? error.message : "语义检索失败，本次使用关键词检索。" };
    }
  }
  onContextSelected?.(selection);
  const input: ChatRequest = {
    messages,
    insights: selection.insights,
    goals: selection.goals,
    ...(selection.preferences ? { preferences: selection.preferences } : {}),
    ...(selection.personalContext ? { personalContext: selection.personalContext } : {}),
  };
  let response: Response;
  try {
    response = await fetcher("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(35000),
    });
  } catch (cause) {
    throw new AppError("NETWORK_ERROR", "无法连接知衡的聊天服务，请稍后重试。", { cause });
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch (cause) {
    throw new AppError("INVALID_RESPONSE", "聊天服务返回了无法读取的结果。", { cause, status: response.status });
  }
  const result = parseChatResponse(body, response.status);
  if (!result.ok) throw new AppError(result.error.code, result.error.message, { status: response.status });
  if (!response.ok) {
    throw new AppError("INVALID_RESPONSE", "聊天服务返回了状态不一致的结果，请重试。", { status: response.status });
  }
  return result.data.reply;
}
