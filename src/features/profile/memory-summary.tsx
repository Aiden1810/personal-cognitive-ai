"use client";

import { useState } from "react";
import type { Conversation } from "@/lib/chat/store";
import type { ProfileInsight } from "@/types/cognitive";
import { selectMemorySummarySources, type MemorySummary } from "@/lib/profile/summary";
import { requestMemorySummary } from "@/lib/profile/summary-api";

export function MemorySummaryPanel({ insights, conversations, onInspect }: { insights: ProfileInsight[]; conversations: Conversation[]; onInspect: (id: string) => void }) {
  const sources = selectMemorySummarySources(insights, conversations);
  const signature = JSON.stringify(sources);
  const [result, setResult] = useState<{ signature: string; summary: MemorySummary } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const current = result?.signature === signature ? result.summary : null;
  const byId = new Map(sources.map((source) => [source.id, source]));
  async function generate() {
    if (busy || sources.length === 0) return;
    setBusy(true); setError("");
    try { const summary = await requestMemorySummary(sources); setResult({ signature, summary }); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "记忆摘要生成失败，请重试。"); }
    finally { setBusy(false); }
  }
  return <section className="memory-summary" aria-labelledby="memory-summary-title">
    <div className="memory-summary-heading"><div><h2 id="memory-summary-title">知衡记住了什么</h2><p>把已确认的记忆按话题归纳，方便核对。</p></div><button type="button" disabled={busy || !sources.length} onClick={() => void generate()}>{busy ? "正在生成摘要…" : current ? "重新生成摘要" : "生成记忆摘要"}</button></div>
    <p className="simple-note">本次读取 {sources.length} 条已确认记忆{insights.length > sources.length ? `，其余 ${insights.length - sources.length} 条仍在原记录中` : ""}。点击生成后，描述与依据发送给模型。摘要是本页临时草稿，后续聊天继续使用原始确认记录。</p>
    {!sources.length && <p className="memory-summary-empty">还没有可归纳的确认记忆。可先填写问卷，或在聊天中整理并确认记忆。</p>}
    {error && <p className="error-notice" role="alert">{error}</p>}
    {result && !current && <p className="memory-summary-empty">记忆已修改、归档或删除，旧摘要已隐藏。需要时请重新生成。</p>}
    {current && current.sections.length === 0 && <p className="memory-summary-empty">当前依据不足以归纳，原记录仍可查看。</p>}
    {current && <div className="memory-summary-sections">{current.sections.map((section, index) => <article key={index}>
      <h3>{section.title}</h3><p>{section.text}</p>
      <details><summary>查看来源与管理记忆 · {section.insightIds.length} 条</summary>
        {section.insightIds.map((id) => {
          const source = byId.get(id);
          return source && <div className="memory-summary-source" key={id}><strong>{source.statement}</strong>
            {source.questionnaireAnsweredAt && <small>问卷填写日期：{source.questionnaireAnsweredAt.map((date) => new Date(date).toLocaleDateString("zh-CN")).join("、")}</small>}
            {source.quotes.map((quote, quoteIndex) => <blockquote key={quoteIndex}>{quote}</blockquote>)}
            <button type="button" className="text-button" onClick={() => onInspect(id)}>查看原记录，修改或删除 ↗</button>
          </div>;
        })}
      </details>
    </article>)}</div>}
  </section>;
}
