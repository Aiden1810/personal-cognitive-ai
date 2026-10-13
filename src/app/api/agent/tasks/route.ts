import { createAgentPlan, parseAgentRequest } from "../../../../lib/agent/model.ts";
import { parseAgentJob, record } from "../../../../lib/agent/protocol.ts";
import { agentFailure, agentJson, callAgentService, denyAgentRequest, readAgentBody } from "../../../../lib/agent/server.ts";
import { AppError } from "../../../../lib/errors.ts";

export async function POST(request: Request): Promise<Response> {
  const denied = denyAgentRequest(request);
  if (denied) return denied;
  try {
    const input = parseAgentRequest(await readAgentBody(request));
    try {
      const existing = parseAgentJob(await callAgentService(`/tasks/${input.requestId}`));
      if (existing.task !== input.task) throw new AppError("CONFLICT", "请求编号已用于另一任务。");
      return agentJson(existing, 202);
    } catch (error) { if (!(error instanceof AppError) || error.code !== "NOT_FOUND") throw error; }
    const health = await callAgentService("/health");
    if (!record(health) || health.ok !== true) throw new AppError("INVALID_RESPONSE", "浏览器执行服务尚未就绪。");
    if (health.busy === true) throw new AppError("CONFLICT", "已有浏览器任务进行中，请等待或取消后重试。");
    const plan = await createAgentPlan(input, { apiKey: process.env.LLM_API_KEY, model: process.env.LLM_MODEL || "deepseek-flash" });
    if (request.signal.aborted) throw new AppError("CONFLICT", "网页查找已取消。");
    return agentJson(parseAgentJob(await callAgentService("/tasks", "POST", { requestId: input.requestId, task: input.task, plan })), 202);
  } catch (error) { return agentFailure(error); }
}
