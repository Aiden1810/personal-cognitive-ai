import { generateProfileReflection, parseReflectionRequest, ReflectionError } from "../../../../lib/profile/reflection.ts";

export async function POST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ ok: false, error: { code: "LLM_UNAVAILABLE", message: "公开部署的综合观察尚未启用。" } }, { status: 503 });
  }
  const origin = request.headers.get("origin");
  const host = request.headers.get("host") ?? new URL(request.url).host;
  let sameLocalOrigin = false;
  try {
    const localHost = new URL(`http://${host}`);
    const browserOrigin = origin ? new URL(origin) : null;
    sameLocalOrigin = ["localhost", "127.0.0.1"].includes(localHost.hostname) &&
      (!browserOrigin || (browserOrigin.protocol === "http:" && browserOrigin.host === localHost.host));
  } catch { /* Invalid Host or Origin is denied below. */ }
  if (!sameLocalOrigin) {
    return Response.json({ ok: false, error: { code: "FORBIDDEN", message: "请求来源不允许。" } }, { status: 403 });
  }
  try {
    const raw = await request.text();
    if (raw.length > 30000) throw new ReflectionError("VALIDATION_ERROR", "请求内容过长。");
    let body: unknown;
    try { body = JSON.parse(raw); }
    catch { throw new ReflectionError("VALIDATION_ERROR", "请求必须是有效的 JSON。"); }
    const insights = parseReflectionRequest(body);
    const reflection = await generateProfileReflection(insights, {
      apiKey: process.env.LLM_API_KEY,
      model: "deepseek-flash",
    });
    return Response.json({ ok: true, data: { reflection } });
  } catch (error) {
    if (error instanceof ReflectionError) {
      return Response.json({ ok: false, error: { code: error.code, message: error.message } },
        { status: error.code === "VALIDATION_ERROR" ? 400 : 503 });
    }
    return Response.json({ ok: false, error: { code: "INTERNAL_ERROR", message: "处理综合观察时出现错误。" } }, { status: 500 });
  }
}
