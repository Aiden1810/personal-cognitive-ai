import { parseMemorySummaryOutput, type MemorySummary } from "./summary.ts";
import type { ReflectionSource } from "./reflection.ts";

export async function requestMemorySummary(sources: ReflectionSource[], fetcher: (input: string, init?: RequestInit) => Promise<Response> = fetch): Promise<MemorySummary> {
  let response: Response;
  try {
    response = await fetcher("/api/profile/summary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ insights: sources }), signal: AbortSignal.timeout(35000) });
  } catch { throw new Error("无法连接记忆摘要服务，请稍后重试。"); }
  let body: unknown;
  try { body = await response.json(); }
  catch { throw new Error("记忆摘要服务返回了无法读取的结果。"); }
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw new Error("记忆摘要服务返回格式无效。");
  const input = body as Record<string, unknown>;
  if (!response.ok) {
    const error = input.error as { message?: unknown } | undefined;
    throw new Error(typeof error?.message === "string" ? error.message : "记忆摘要生成失败，请重试。");
  }
  const data = input.data as { summary?: unknown } | undefined;
  return parseMemorySummaryOutput(data?.summary, sources);
}
