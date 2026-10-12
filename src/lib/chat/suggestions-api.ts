import type { ChatMessage } from "./store.ts";
import type { ChatContextSelection } from "./context.ts";
import { bindChatSuggestions, isChatActionDraft, parseSuggestedActions, type ChatSuggestion } from "./suggestions.ts";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function requestChatSuggestions(
  history: ChatMessage[], reply: string, selection: ChatContextSelection,
  fetcher: (input: string, init?: RequestInit) => Promise<Response> = fetch,
): Promise<ChatSuggestion[]> {
  const source = history.at(-1);
  if (source?.role !== "user") throw new Error("建议检测需要对应的用户发言。");
  let response: Response;
  try {
    response = await fetcher("/api/chat/suggestions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: source.content }], reply: reply.slice(0, 10000), insights: selection.insights, goals: selection.goals }),
      signal: AbortSignal.timeout(35000),
    });
  } catch { throw new Error("无法连接操作建议服务，聊天回复已保留。"); }
  let body: unknown;
  try { body = await response.json(); }
  catch { throw new Error("操作建议服务返回了无法读取的结果。"); }
  if (!response.ok) {
    const error = record(body) ? body.error : null;
    throw new Error(record(error) && typeof error.message === "string" ? error.message : "操作建议检测失败。");
  }
  const data = record(body) ? body.data : null;
  const actions = record(data) ? data.suggestions : null;
  if (!Array.isArray(actions) || actions.length > 3 || !actions.every(isChatActionDraft) ||
    new Set(actions.map((item) => item.kind)).size !== actions.length) throw new Error("操作建议格式无效，未保存建议。");
  const validated = parseSuggestedActions({
    suggestedGoal: actions.find((item) => item.kind === "goal") ?? null,
    suggestedArchive: actions.find((item) => item.kind === "archive") ?? null,
    suggestedOutcome: actions.find((item) => item.kind === "outcome") ?? null,
  }, { question: source.content, insights: selection.insights, goals: selection.goals });
  return bindChatSuggestions(validated, source.id);
}
