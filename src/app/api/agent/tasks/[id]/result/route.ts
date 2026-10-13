import { parseAgentRequest, summarizeAgentResults } from "../../../../../../lib/agent/model.ts";
import { parseAgentJob, validTaskId } from "../../../../../../lib/agent/protocol.ts";
import { agentFailure, agentJson, callAgentService, denyAgentRequest, readAgentBody } from "../../../../../../lib/agent/server.ts";
import { AppError } from "../../../../../../lib/errors.ts";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = denyAgentRequest(request);
  if (denied) return denied;
  try {
    const { id } = await context.params;
    if (!validTaskId(id)) throw new AppError("VALIDATION_ERROR", "任务编号无效。");
    const input = parseAgentRequest(await readAgentBody(request));
    const job = parseAgentJob(await callAgentService(`/tasks/${id}`));
    if (input.requestId !== id || input.task !== job.task) throw new AppError("VALIDATION_ERROR", "整理请求与原任务不一致。");
    if (job.status !== "completed") throw new AppError("CONFLICT", "浏览器尚未取得完成的候选结果。");
    const reply = await summarizeAgentResults(input, job.plan, job.resources, { apiKey: process.env.LLM_API_KEY, model: process.env.LLM_MODEL || "deepseek-flash" });
    return agentJson({ reply });
  } catch (error) { return agentFailure(error); }
}
