import type { ChatMessage } from "./store.ts";
import type { ProfileInsight, UserGoal } from "../../types/cognitive.ts";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
): Promise<string> {
  if (history.length === 0 || history.at(-1)?.role !== "user") {
    throw new Error("请先发送一条用户消息。");
  }
  const messages = recentMessages(history);
  let response: Response;
  try {
    response = await fetcher("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        insights: insights.filter((item) => item.status === "confirmed"),
        goals: goals.filter((goal) => goal.status === "active"),
      }),
      signal: AbortSignal.timeout(35000),
    });
  } catch {
    throw new Error("无法连接知衡的聊天服务，请稍后重试。");
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("聊天服务返回了无法读取的结果。");
  }
  if (!response.ok) {
    const error = record(body) ? body.error : null;
    const message = record(error) ? error.message : null;
    throw new Error(typeof message === "string" ? message : "AI 回复失败，请稍后重试。");
  }
  const data = record(body) ? body.data : null;
  const reply = record(data) ? data.reply : null;
  if (typeof reply !== "string" || !reply.trim()) {
    throw new Error("聊天服务没有返回可用的回复。");
  }
  return reply.trim();
}
