"use client";

import type { AgentProgress, AgentRequest } from "@/types/agent";
import type { ChatContextSelection } from "@/lib/chat/context";

export interface AgentRunView extends AgentProgress { messageId: string; input: AgentRequest; selection: ChatContextSelection; error?: string; }

const LABELS = { planning: "正在制定搜索计划", browsing: "正在查找资料", summarizing: "正在根据本次资料整理结果", cancelling: "正在停止任务", completed: "网页查找已完成", failed: "网页查找未完成", cancelled: "网页查找已取消" };

export function AgentTaskCard({ run, onCancel }: { run: AgentRunView; onCancel: () => void }) {
  const lastEvent = run.job?.events.at(-1);
  const active = ["planning", "browsing", "summarizing", "cancelling"].includes(run.phase) || run.phase === "failed" && !!run.job && ["queued", "running", "cancelling"].includes(run.job.status);
  return <section className="agent-task" data-phase={run.phase} aria-label="网页查找执行过程">
    <div className="agent-task-heading">
      <div><span className="agent-task-label">网页查找</span><strong role="status">{LABELS[run.phase]}</strong></div>
      {active && <button type="button" className="text-button" onClick={onCancel} disabled={run.phase === "cancelling"}>停止查找</button>}
    </div>
    <p className="agent-task-context">本次参考 {run.input.insights.length} 条确认记忆、{run.input.goals.length} 项启用目标{run.input.personalContext?.background ? "及已启用的个人背景" : ""}</p>
    {run.phase === "browsing" && lastEvent && <p className="agent-task-current">
      {lastEvent.message}{lastEvent.url && <> · <a href={lastEvent.url} target="_blank" rel="noreferrer">{lastEvent.title || new URL(lastEvent.url).hostname}</a></>}
    </p>}
    {run.error && <p className="agent-task-error" role="alert">{run.error}</p>}
    {run.job && <details className="agent-task-details">
      <summary>查看搜索计划与实际访问</summary>
      <p>{run.job.plan.objective}</p>
      <div className="agent-task-plan"><div><strong>搜索词</strong><ul>{run.job.plan.queries.map((query, index) => <li key={index}>{query}</li>)}</ul></div>
        <div><strong>筛选条件</strong><ul>{run.job.plan.criteria.map((criterion, index) => <li key={index}>{criterion}</li>)}</ul></div></div>
      {run.job.events.length > 0 && <ol className="agent-task-events" aria-label="真实执行记录">
        {run.job.events.map((event) => <li key={event.sequence}>{event.message}{event.url && <> · <a href={event.url} target="_blank" rel="noreferrer">{event.title || new URL(event.url).hostname}</a></>}</li>)}
      </ol>}
      {run.job.resources.length > 0 && <p>已核对 {run.job.resources.length} 个候选资源，最终回复中的链接与原文来自这些访问。</p>}
    </details>}
    {run.phase === "cancelled" && <p className="agent-task-context">你的任务消息已保留，可以调整后重新发送。</p>}
  </section>;
}
