import type { ProfileInsight } from "../../types/cognitive.ts";
import { parseReflectionOutput, type ProfileReflection, type ReflectionSource } from "./reflection.ts";

export function selectReflectionSources(insights: ProfileInsight[]): ReflectionSource[] {
  return insights.slice(-20).map(({ id, dimension, statement, evidence }) => ({
    id, dimension, statement, quotes: evidence.map(({ excerpt }) => excerpt),
    ...(evidence.some((source) => source.kind === "questionnaire") ? { questionnaireAnsweredAt: [...new Set(evidence.filter((source) => source.kind === "questionnaire").map((source) => source.answeredAt))] } : {}),
  }));
}

export async function requestProfileReflection(
  sources: ReflectionSource[],
  fetcher: (input: string, init?: RequestInit) => Promise<Response> = fetch,
): Promise<ProfileReflection> {
  let response: Response;
  try {
    response = await fetcher("/api/profile/reflect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ insights: sources }),
      signal: AbortSignal.timeout(35000),
    });
  } catch { throw new Error("无法连接综合观察服务，请稍后重试。"); }
  let body: unknown;
  try { body = await response.json(); }
  catch { throw new Error("综合观察服务返回了无法读取的结果。"); }
  if (!response.ok) {
    const error = typeof body === "object" && body !== null && "error" in body ? body.error : null;
    const message = typeof error === "object" && error !== null && "message" in error ? error.message : null;
    throw new Error(typeof message === "string" ? message : "生成综合观察失败，请稍后重试。");
  }
  const data = typeof body === "object" && body !== null && "data" in body ? body.data : null;
  const reflection = typeof data === "object" && data !== null && "reflection" in data ? data.reflection : null;
  return parseReflectionOutput(reflection, sources);
}
