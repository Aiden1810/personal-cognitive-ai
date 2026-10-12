import { ChatError } from "../../../../lib/ai/chat.ts";
import { generateChatSuggestions, parseSuggestionRequest } from "../../../../lib/ai/suggestions.ts";

export async function POST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ ok: false, error: { code: "LLM_UNAVAILABLE", message: "公开部署的 AI 操作建议尚未启用。" } }, { status: 503 });
  }
  const host = request.headers.get("host") ?? new URL(request.url).host;
  const origin = request.headers.get("origin");
  let allowed = false;
  try {
    const localHost = new URL(`http://${host}`);
    const browserOrigin = origin ? new URL(origin) : null;
    allowed = ["localhost", "127.0.0.1"].includes(localHost.hostname) &&
      (!browserOrigin || (browserOrigin.protocol === "http:" && browserOrigin.host === localHost.host));
  } catch { /* Invalid origins are denied. */ }
  if (!allowed) return Response.json({ ok: false, error: { code: "FORBIDDEN", message: "请求来源不允许。" } }, { status: 403 });

  try {
    const raw = await request.text();
    if (raw.length > 100000) throw new ChatError("VALIDATION_ERROR", "请求内容过长。");
    let body: unknown;
    try { body = JSON.parse(raw); }
    catch { throw new ChatError("VALIDATION_ERROR", "请求必须是有效的 JSON。"); }
    const input = parseSuggestionRequest(body);
    const suggestions = await generateChatSuggestions(input, {
      apiKey: process.env.LLM_API_KEY, model: process.env.LLM_MODEL || "deepseek-flash",
    });
    return Response.json({ ok: true, data: { suggestions } });
  } catch (error) {
    if (error instanceof ChatError) return Response.json({ ok: false, error: { code: error.code, message: error.message } }, { status: error.code === "VALIDATION_ERROR" ? 400 : 503 });
    return Response.json({ ok: false, error: { code: "INTERNAL_ERROR", message: "建议检测失败，聊天回复已保留。" } }, { status: 500 });
  }
}
