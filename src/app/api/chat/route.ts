import { ChatError, generateChatReply, parseChatRequest } from "../../../lib/ai/chat.ts";
import type { ChatResponse } from "../../../types/chat-api.ts";

function jsonResponse(body: ChatResponse, status = 200): Response {
  return Response.json(body, { status });
}

export async function POST(request: Request): Promise<Response> {
  // Until accounts and abuse protection exist, this endpoint is for local development only.
  if (process.env.NODE_ENV === "production") {
    return jsonResponse(
      { ok: false, error: { code: "LLM_UNAVAILABLE", message: "公开部署的 AI 聊天尚未启用。" } },
      503,
    );
  }

  const origin = request.headers.get("origin");
  const host = request.headers.get("host") ?? new URL(request.url).host;
  let sameLocalOrigin = false;
  try {
    const localHost = new URL(`http://${host}`);
    const browserOrigin = origin ? new URL(origin) : null;
    sameLocalOrigin =
      ["localhost", "127.0.0.1"].includes(localHost.hostname) &&
      (!browserOrigin || (browserOrigin.protocol === "http:" && browserOrigin.host === localHost.host));
  } catch {
    // Invalid Host or Origin is denied below.
  }
  if (!sameLocalOrigin) {
    return jsonResponse(
      { ok: false, error: { code: "FORBIDDEN", message: "请求来源不允许。" } },
      403,
    );
  }

  try {
    const raw = await request.text();
    if (raw.length > 100000) {
      throw new ChatError("VALIDATION_ERROR", "请求内容过长。");
    }
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new ChatError("VALIDATION_ERROR", "请求必须是有效的 JSON。");
    }
    const input = parseChatRequest(body);
    const reply = await generateChatReply(input, {
      apiKey: process.env.LLM_API_KEY,
      model: process.env.LLM_MODEL || "deepseek-flash",
    });
    return jsonResponse({ ok: true, data: { reply } });
  } catch (error) {
    if (error instanceof ChatError) {
      return jsonResponse(
        { ok: false, error: { code: error.code, message: error.message } },
        error.code === "VALIDATION_ERROR" ? 400 : 503,
      );
    }
    return jsonResponse(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "处理请求时出现错误。" } },
      500,
    );
  }
}
