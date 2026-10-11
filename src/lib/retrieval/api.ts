import type { SemanticMatches } from "./hybrid.ts";
import type { ProfileInsight, UserGoal } from "../../types/cognitive.ts";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function completeScores(value: unknown, ids: string[]): value is Record<string, number> {
  return record(value) && Object.keys(value).length === ids.length && ids.every((id) =>
    Object.hasOwn(value, id) && typeof value[id] === "number" && Number.isFinite(value[id]) && value[id] >= -1 && value[id] <= 1);
}

export async function requestSemanticMatches(
  query: string,
  insights: ProfileInsight[],
  goals: UserGoal[],
  fetcher: (input: string, init?: RequestInit) => Promise<Response> = fetch,
): Promise<SemanticMatches> {
  const statements = insights.filter((item) => item.status === "confirmed" && item.evidence.length > 0).map(({ id, statement }) => ({ id, text: statement }));
  const intentions = goals.filter((item) => item.status === "active").map(({ id, intention }) => ({ id, text: intention }));
  const texts = [query, ...statements.map((item) => item.text), ...intentions.map((item) => item.text)];
  if (statements.length + intentions.length > 100 || texts.some((text) => !text.trim() || text.length > 1200) || texts.join("").length > 20000) {
    throw new Error("资料超过语义实验的处理上限，本次使用关键词检索。");
  }
  let data: unknown;
  try {
    const response = await fetcher("/api/retrieval/semantic", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, insights: statements, goals: intentions }),
      signal: AbortSignal.timeout(6500),
    });
    if (!response.ok) throw new Error("unavailable");
    const body: unknown = await response.json();
    data = record(body) ? body.data : null;
  } catch {
    throw new Error("本地语义服务不可用或超时，本次使用关键词检索。");
  }
  if (!record(data) || typeof data.model !== "string" || !data.model.trim() || data.model.length > 200 ||
    !completeScores(data.insights, statements.map((item) => item.id)) || !completeScores(data.goals, intentions.map((item) => item.id))) {
    throw new Error("语义结果不完整，本次使用关键词检索。");
  }
  return { model: data.model, insights: data.insights, goals: data.goals };
}
