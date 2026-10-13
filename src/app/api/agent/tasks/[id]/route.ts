import { parseAgentJob, record, validTaskId } from "../../../../../lib/agent/protocol.ts";
import { agentFailure, agentJson, callAgentService, denyAgentRequest } from "../../../../../lib/agent/server.ts";
import { AppError } from "../../../../../lib/errors.ts";

type Context = { params: Promise<{ id: string }> };

async function handle(request: Request, context: Context, method: string): Promise<Response> {
  const denied = denyAgentRequest(request);
  if (denied) return denied;
  try {
    const { id } = await context.params;
    if (!validTaskId(id)) throw new AppError("VALIDATION_ERROR", "任务编号无效。");
    const result = await callAgentService(`/tasks/${id}`, method);
    if (method === "DELETE" && record(result) && result.cancelled === true) return agentJson(null);
    return agentJson(parseAgentJob(result));
  } catch (error) { return agentFailure(error); }
}

export async function GET(request: Request, context: Context) { return handle(request, context, "GET"); }
export async function DELETE(request: Request, context: Context) { return handle(request, context, "DELETE"); }
