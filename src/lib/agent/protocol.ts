import { AppError } from "../errors.ts";
import { type AgentJob, type SearchPlan } from "../../types/agent.ts";

export function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
export function text(value: unknown, max: number): value is string { return typeof value === "string" && !!value.trim() && value.length <= max; }
export function validTaskId(value: unknown): value is string { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value); }
export function allowedUrl(value: unknown, includeSearch = false): value is string {
  if (!text(value, 4000) || /[\s\\]/u.test(value)) return false;
  try {
    const url = new URL(value);
    const host = url.hostname;
    const labels = host.split(".");
    const localSuffixes = ["localhost", "local", "internal", "lan", "home", "test", "invalid", "example", "onion", "arpa"];
    return url.protocol === "https:" && !url.username && !url.password && !url.port && host.length <= 253 && labels.length >= 2 &&
      labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(label)) &&
      /^(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/u.test(labels.at(-1)!) && !localSuffixes.includes(labels.at(-1)!) &&
      (includeSearch || !(host === "bing.com" || host.endsWith(".bing.com")));
  } catch { return false; }
}

export function parseSearchPlan(value: unknown): SearchPlan {
  if (!record(value) || !text(value.objective, 500) || !Array.isArray(value.queries) || value.queries.length < 1 || value.queries.length > 3 ||
      !value.queries.every((item) => text(item, 120)) || !Array.isArray(value.criteria) || value.criteria.length < 1 || value.criteria.length > 6 ||
      !value.criteria.every((item) => text(item, 150))) throw new AppError("INVALID_MODEL_OUTPUT", "搜索计划格式无效，请重新尝试。");
  return { objective: value.objective.trim(), queries: value.queries.map((item: string) => item.trim()), criteria: value.criteria.map((item: string) => item.trim()) };
}

function date(value: unknown): value is string { return typeof value === "string" && value.length <= 50 && Number.isFinite(Date.parse(value)); }

export function parseAgentJob(value: unknown): AgentJob {
  const invalid = () => { throw new AppError("INVALID_RESPONSE", "浏览器服务返回了无法核对的任务数据。"); };
  if (!record(value) || !validTaskId(value.id) || !text(value.task, 2000) || !["queued", "running", "cancelling", "completed", "failed", "cancelled"].includes(String(value.status)) ||
      !date(value.createdAt) || !(value.finishedAt === null || date(value.finishedAt)) || !(value.error === null || text(value.error, 500)) ||
      !Array.isArray(value.events) || value.events.length > 100 || !Array.isArray(value.resources) || value.resources.length > 5) return invalid();
  const plan = parseSearchPlan(value.plan);
  if (!value.events.every((event, index) => record(event) && event.sequence === index + 1 &&
      ["start", "search", "browse", "extract", "result"].includes(String(event.kind)) && text(event.message, 300) && date(event.at) &&
      (event.url === null || allowedUrl(event.url, true)) && (event.title === null || typeof event.title === "string" && event.title.length <= 500))) return invalid();
  if (!value.resources.every((item) => record(item) && allowedUrl(item.url) && text(item.title, 500) && text(item.excerpt, 1200) && date(item.visitedAt)) ||
      new Set(value.resources.map((item) => (item as Record<string, unknown>).url)).size !== value.resources.length ||
      value.status === "completed" && value.resources.length === 0) return invalid();
  return { ...(value as unknown as AgentJob), plan };
}
