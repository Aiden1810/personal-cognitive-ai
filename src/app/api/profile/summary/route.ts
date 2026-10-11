import { generateMemorySummary, MAX_SUMMARY_REQUEST_CHARACTERS } from "../../../../lib/profile/summary.ts";
import { parseReflectionRequest, ReflectionError } from "../../../../lib/profile/reflection.ts";
import { ChatError } from "../../../../lib/ai/chat.ts";

export async function POST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === "production") return Response.json({ ok: false, error: { code: "LLM_UNAVAILABLE", message: "公开部署的记忆摘要尚未启用。" } }, { status: 503 });
  const origin = request.headers.get("origin");
  const host = request.headers.get("host") ?? new URL(request.url).host;
  let allowed = false;
  try {
    const local = new URL(`http://${host}`);
    const browser = origin ? new URL(origin) : null;
    allowed = ["localhost", "127.0.0.1"].includes(local.hostname) && (!browser || (browser.protocol === "http:" && browser.host === local.host));
  } catch { /* Malformed origins are rejected. */ }
  if (!allowed) return Response.json({ ok: false, error: { code: "FORBIDDEN", message: "请求来源不允许。" } }, { status: 403 });
  try {
    const raw = await request.text();
    if (raw.length > MAX_SUMMARY_REQUEST_CHARACTERS) throw new ReflectionError("VALIDATION_ERROR", "记忆摘要资料过长。");
    let body: unknown;
    try { body = JSON.parse(raw); }
    catch { throw new ReflectionError("VALIDATION_ERROR", "请求必须是有效的 JSON。"); }
    const sources = parseReflectionRequest(body);
    const summary = await generateMemorySummary(sources, { apiKey: process.env.LLM_API_KEY, model: process.env.LLM_MODEL || "deepseek-flash" });
    return Response.json({ ok: true, data: { summary } });
  } catch (error) {
    if (error instanceof ReflectionError || error instanceof ChatError) return Response.json({ ok: false, error: { code: error.code, message: error.message } }, { status: error.code === "VALIDATION_ERROR" ? 400 : 503 });
    return Response.json({ ok: false, error: { code: "INTERNAL_ERROR", message: "处理记忆摘要时出现错误。" } }, { status: 500 });
  }
}
