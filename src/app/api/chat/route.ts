import { ChatError, generateChatReply, parseChatRequest } from "../../../lib/ai/chat.ts";

export async function POST(request: Request): Promise<Response> {
  // Until accounts and abuse protection exist, this endpoint is for local development only.
  if (process.env.NODE_ENV === "production") {
    return Response.json(
      { ok: false, error: { code: "LLM_UNAVAILABLE", message: "公开部署的 AI 聊天尚未启用。" } },
      { status: 503 },
    );
  }

  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json(
      { ok: false, error: { code: "FORBIDDEN", message: "请求来源不允许。" } },
      { status: 403 },
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
      model: process.env.LLM_MODEL || "deepseek-v4-pro",
    });
    return Response.json({ ok: true, data: { reply } });
  } catch (error) {
    if (error instanceof ChatError) {
      return Response.json(
        { ok: false, error: { code: error.code, message: error.message } },
        { status: error.code === "VALIDATION_ERROR" ? 400 : 503 },
      );
    }
    return Response.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "处理请求时出现错误。" } },
      { status: 500 },
    );
  }
}
