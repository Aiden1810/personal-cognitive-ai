import assert from "node:assert/strict";
import test from "node:test";
import { runAgentTask } from "../src/lib/agent/api.ts";
import type { AgentRequest } from "../src/types/agent.ts";

const input: AgentRequest = { requestId: "5be5145e-232b-4283-aa1e-728b16a80dbd", task: "查找 Python 资料", insights: [], goals: [] };
const job = { id: input.requestId, task: input.task, status: "running", plan: { objective: "资料", queries: ["Python tutorial"], criteria: ["免费"] }, events: [], resources: [], createdAt: "2026-10-12T00:00:00Z", finishedAt: null, error: null };
const completed = { ...job, status: "completed", finishedAt: "2026-10-12T00:01:00Z", resources: [{ url: "https://docs.python.org/3/tutorial/", title: "Python", excerpt: "Python", visitedAt: "2026-10-12T00:00:00Z" }] };

test("client polls actual task state then summarizes once", async () => {
  const calls: string[] = [];
  const phases: string[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    calls.push(`${init?.method ?? "GET"} ${url}`);
    return Response.json({ ok: true, data: String(url).endsWith("/result") ? { reply: "真实结果" } : init?.method === "POST" ? job : completed });
  };
  const result = await runAgentTask(input, (state) => phases.push(state.phase), undefined, fetcher, async () => {});
  assert.equal(result.reply, "真实结果");
  assert.deepEqual(phases, ["planning", "browsing", "browsing", "summarizing", "completed"]);
  assert.equal(calls.filter((call) => call.includes("/result")).length, 1);
});

test("cancel during planning sends DELETE for the known request id", async () => {
  const controller = new AbortController();
  const calls: string[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    calls.push(`${init?.method} ${url}`);
    if (init?.method === "POST") { controller.abort(); throw new DOMException("cancelled", "AbortError"); }
    return Response.json({ ok: true, data: null });
  };
  await assert.rejects(runAgentTask(input, () => {}, controller.signal, fetcher), (error: Error) => error.name === "AbortError");
  assert.ok(calls.some((call) => call === `DELETE /api/agent/tasks/${input.requestId}`));
});

test("failed summary preserves completed candidates for retry", async () => {
  let lastResources = 0;
  const fetcher: typeof fetch = async (url) => String(url).endsWith("/result")
    ? Response.json({ ok: false, error: { code: "LLM_UNAVAILABLE", message: "模型暂时失败" } }, { status: 503 })
    : Response.json({ ok: true, data: completed });
  await assert.rejects(runAgentTask(input, (state) => { lastResources = state.job?.resources.length ?? 0; }, undefined, fetcher, async () => {}), /模型暂时失败/);
  assert.equal(lastResources, 1);
});

test("client never displays a different task returned by the create endpoint", async () => {
  const displayed: string[] = [];
  const fetcher: typeof fetch = async (_url, init) => Response.json({ ok: true, data: init?.method === "DELETE" ? null : { ...completed, id: "aabbccdd-232b-4283-aa1e-728b16a80dbd" } });
  await assert.rejects(runAgentTask(input, (state) => { if (state.job) displayed.push(state.job.id); }, undefined, fetcher), /另一任务/);
  assert.deepEqual(displayed, []);
});
