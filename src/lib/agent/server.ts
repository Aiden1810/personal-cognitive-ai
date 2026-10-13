import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { AppError } from "../errors.ts";
import { record } from "./protocol.ts";

export function agentJson(data: unknown, status = 200): Response { return Response.json({ ok: true, data }, { status, headers: { "Cache-Control": "no-store" } }); }

export function denyAgentRequest(request: Request): Response | null {
  if (process.env.NODE_ENV === "production") return Response.json({ ok: false, error: { code: "FORBIDDEN", message: "公开部署的浏览器执行尚未启用。" } }, { status: 503 });
  try {
    const host = request.headers.get("host") ?? new URL(request.url).host;
    const local = new URL(`http://${host}`);
    const origin = request.headers.get("origin");
    if (["localhost", "127.0.0.1"].includes(local.hostname) && (!origin || new URL(origin).protocol === "http:" && new URL(origin).host === local.host)) return null;
  } catch { /* deny malformed origins */ }
  return Response.json({ ok: false, error: { code: "FORBIDDEN", message: "请求来源不允许。" } }, { status: 403 });
}

export function agentFailure(error: unknown): Response {
  const known = error instanceof AppError ? error : new AppError("INTERNAL_ERROR", "处理浏览器任务时出现错误，请重试。");
  const status = known.status ?? (known.code === "VALIDATION_ERROR" ? 400 : known.code === "NOT_FOUND" ? 404 : known.code === "CONFLICT" ? 409 : 503);
  return Response.json({ ok: false, error: { code: known.code, message: known.message } }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function readAgentBody(request: Request): Promise<unknown> {
  const body = await request.text();
  if (body.length > 20000) throw new AppError("VALIDATION_ERROR", "任务请求过长。");
  try { return JSON.parse(body); } catch { throw new AppError("VALIDATION_ERROR", "任务请求必须是有效 JSON。"); }
}

export async function callAgentService(path: string, method = "GET", body?: unknown): Promise<unknown> {
  let token: string;
  try { token = (await readFile(join(process.cwd(), "output", "browser-agent", "service-token.txt"), "utf8")).trim(); }
  catch { throw new AppError("NETWORK_ERROR", "浏览器执行服务尚未启动，请先启动本地执行服务。"); }
  const url = new URL(process.env.BROWSER_AGENT_URL || "http://127.0.0.1:8001");
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new AppError("VALIDATION_ERROR", "浏览器执行服务必须使用本地 HTTP 地址。");
  let response: Response;
  try {
    response = await fetch(new URL(path, url), { method, cache: "no-store", headers: { "Content-Type": "application/json", "X-Agent-Token": token },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(30000) });
  } catch { throw new AppError("NETWORK_ERROR", "无法连接浏览器执行服务，请确认本地服务已启动。"); }
  let result: unknown;
  try { result = await response.json(); } catch { throw new AppError("INVALID_RESPONSE", "浏览器执行服务没有返回可读取的结果。"); }
  if (!response.ok) {
    const code = response.status === 404 ? "NOT_FOUND" : response.status === 409 ? "CONFLICT" : response.status === 422 ? "VALIDATION_ERROR" : "NETWORK_ERROR";
    const message = response.status === 403 ? "本地执行服务连接配置不一致，请重新启动服务。" : record(result) && typeof result.detail === "string" ? result.detail.slice(0, 500) : "浏览器执行服务请求失败。";
    throw new AppError(code, message, { status: response.status === 403 ? 503 : response.status });
  }
  return result;
}
