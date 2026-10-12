import {
  ExtractionError,
  extractProfileCandidates,
  parseExtractionRequest,
} from "../../../../lib/profile/extract.ts";

export async function POST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === "production") {
    return Response.json(
      { ok: false, error: { code: "LLM_UNAVAILABLE", message: "公开部署的画像提取尚未启用。" } },
      { status: 503 },
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
    return Response.json(
      { ok: false, error: { code: "FORBIDDEN", message: "请求来源不允许。" } },
      { status: 403 },
    );
  }

  try {
    const raw = await request.text();
    if (raw.length > 50000) {
      throw new ExtractionError("VALIDATION_ERROR", "请求内容过长。");
    }
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new ExtractionError("VALIDATION_ERROR", "请求必须是有效的 JSON。");
    }
    const input = parseExtractionRequest(body);
    const candidates = await extractProfileCandidates(input, {
      apiKey: process.env.LLM_API_KEY,
      model: process.env.LLM_MODEL || "deepseek-flash",
    });
    return Response.json({ ok: true, data: { candidates } });
  } catch (error) {
    if (error instanceof ExtractionError) {
      return Response.json(
        { ok: false, error: { code: error.code, message: error.message } },
        { status: error.code === "VALIDATION_ERROR" ? 400 : 503 },
      );
    }
    return Response.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "处理画像请求时出现错误。" } },
      { status: 500 },
    );
  }
}
