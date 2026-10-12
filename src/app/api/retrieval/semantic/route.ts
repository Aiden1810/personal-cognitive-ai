import { parseSemanticInput, scoreSemanticInput } from "../../../../lib/retrieval/scoring.ts";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: { message: "公开部署的语义检索实验尚未启用。" } }, { status: 503 });
  }
  const host = request.headers.get("host") ?? new URL(request.url).host;
  const origin = request.headers.get("origin");
  let allowed = false;
  try {
    const local = new URL(`http://${host}`);
    const browser = origin ? new URL(origin) : null;
    allowed = ["localhost", "127.0.0.1"].includes(local.hostname) &&
      (!browser || (browser.protocol === "http:" && browser.host === local.host));
  } catch { /* Invalid origin is rejected below. */ }
  if (!allowed) return Response.json({ error: { message: "请求来源不允许。" } }, { status: 403 });

  let input;
  try {
    const raw = await request.text();
    if (raw.length > 100000) throw new Error("请求内容过长。");
    input = parseSemanticInput(JSON.parse(raw));
  } catch {
    return Response.json({ error: { message: "语义检索请求无效或超过处理上限。" } }, { status: 400 });
  }
  try {
    const data = await scoreSemanticInput(input);
    return Response.json({ data });
  } catch {
    // Do not leak local paths, runtime internals or text through error responses.
    return Response.json({ error: { message: "本地语义模型暂不可用，请检查模型已准备。" } }, { status: 503 });
  }
}
