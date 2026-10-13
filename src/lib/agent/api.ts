import { AppError, APP_ERROR_CODES, type AppErrorCode } from "../errors.ts";
import { parseAgentJob, record, text } from "./protocol.ts";
import type { AgentJob, AgentProgress, AgentRequest } from "../../types/agent.ts";

async function requestData(path: string, method: string, body: unknown, signal: AbortSignal | undefined, fetcher: typeof fetch, keepalive = false): Promise<unknown> {
  const timeout = AbortSignal.timeout(method === "DELETE" ? 35000 : 40000);
  const response = await fetcher(path, { method, headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: signal ? AbortSignal.any([signal, timeout]) : timeout, keepalive });
  let result: unknown;
  try { result = await response.json(); } catch { throw new AppError("INVALID_RESPONSE", "网页查找服务没有返回可读取的结果。"); }
  if (record(result) && result.ok === false && record(result.error) && text(result.error.message, 1000)) {
    const code = APP_ERROR_CODES.includes(result.error.code as AppErrorCode) ? result.error.code as AppErrorCode : "INVALID_RESPONSE";
    throw new AppError(code, result.error.message, { status: response.status });
  }
  if (!response.ok || !record(result) || result.ok !== true) throw new AppError("INVALID_RESPONSE", "网页查找服务返回了无效状态。");
  return result.data;
}

export async function cancelAgentTask(id: string, fetcher: typeof fetch = fetch): Promise<void> {
  const data = await requestData(`/api/agent/tasks/${id}`, "DELETE", undefined, undefined, fetcher, true);
  if (data === null) return;
  const job = parseAgentJob(data);
  if (["queued", "running", "cancelling"].includes(job.status)) throw new AppError("NETWORK_ERROR", "停止任务尚未确认，请稍后检查状态。");
}

export async function requestAgentSummary(input: AgentRequest, signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<string> {
  const result = await requestData(`/api/agent/tasks/${input.requestId}/result`, "POST", input, signal, fetcher);
  if (!record(result) || !text(result.reply, 10000)) throw new AppError("INVALID_RESPONSE", "结果整理没有返回可保存的回复。");
  return result.reply;
}

function pause(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException("Cancelled", "AbortError")); return; }
    const stopped = () => { clearTimeout(timer); signal?.removeEventListener("abort", stopped); reject(new DOMException("Cancelled", "AbortError")); };
    const timer = setTimeout(() => { signal?.removeEventListener("abort", stopped); resolve(); }, 1500);
    signal?.addEventListener("abort", stopped, { once: true });
  });
}

export async function runAgentTask(input: AgentRequest, onProgress: (state: AgentProgress) => void, signal?: AbortSignal,
  fetcher: typeof fetch = fetch, wait: () => Promise<void> = () => pause(signal)): Promise<{ reply: string; job: AgentJob }> {
  let job: AgentJob | undefined;
  onProgress({ phase: "planning" });
  try {
    signal?.throwIfAborted();
    job = parseAgentJob(await requestData("/api/agent/tasks", "POST", input, signal, fetcher));
    if (job.id !== input.requestId || job.task !== input.task.trim()) throw new AppError("INVALID_RESPONSE", "浏览器返回了另一任务的状态。");
    const deadline = Date.now() + 280000;
    onProgress({ phase: "browsing", job });
    while (["queued", "running", "cancelling"].includes(job.status)) {
      signal?.throwIfAborted();
      if (Date.now() > deadline) throw new AppError("NETWORK_ERROR", "浏览器任务超过等待上限，正在停止，请缩小范围后重试。");
      await wait();
      job = parseAgentJob(await requestData(`/api/agent/tasks/${input.requestId}`, "GET", undefined, signal, fetcher));
      if (job.id !== input.requestId) throw new AppError("INVALID_RESPONSE", "浏览器返回了另一任务的状态。");
      onProgress({ phase: "browsing", job });
    }
    if (job.status === "cancelled") throw new DOMException("网页查找已取消。", "AbortError");
    if (job.status === "failed") throw new AppError("NETWORK_ERROR", job.error ?? "浏览器查找失败，请重试。");
    onProgress({ phase: "summarizing", job });
    const reply = await requestAgentSummary(input, signal, fetcher);
    signal?.throwIfAborted();
    onProgress({ phase: "completed", job });
    return { reply, job };
  } catch (error) {
    if (signal?.aborted) {
      try { await cancelAgentTask(input.requestId, fetcher); }
      catch { throw new AppError("NETWORK_ERROR", "停止任务未能确认，任务可能仍在执行，请检查本地执行服务。"); }
      throw new DOMException("网页查找已取消。", "AbortError");
    }
    if (!job || ["queued", "running", "cancelling"].includes(job.status)) {
      try { await cancelAgentTask(input.requestId, fetcher); } catch { /* Preserve the original connection error. */ }
    }
    if (error instanceof AppError || error instanceof DOMException) throw error;
    throw new AppError("NETWORK_ERROR", "连接网页查找服务失败，请检查本地服务后重试。");
  }
}
