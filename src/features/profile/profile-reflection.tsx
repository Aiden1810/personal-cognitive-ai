"use client";

import { useState } from "react";
import type { ProfileInsight } from "@/types/cognitive";
import { requestProfileReflection, selectReflectionSources } from "@/lib/profile/reflection-api";
import type { ProfileReflection, ReflectionPoint } from "@/lib/profile/reflection";

export function ProfileReflectionPanel({ insights }: { insights: ProfileInsight[] }) {
  const sources = selectReflectionSources(insights);
  const signature = JSON.stringify(sources);
  const [result, setResult] = useState<{ signature: string; data: ProfileReflection } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = result?.signature === signature ? result.data : null;
  const byId = new Map(sources.map((source) => [source.id, source]));

  async function generate() {
    if (busy || sources.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const data = await requestProfileReflection(sources);
      setResult({ signature, data });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "综合观察失败，请稍后重试。");
    } finally { setBusy(false); }
  }

  function column(title: string, items: ReflectionPoint[], empty: string) {
    return (
      <section className="reflection-column">
        <h3>{title}</h3>
        {items.length === 0 && <p className="reflection-empty">{empty}</p>}
        {items.map((item, index) => (
          <article className="reflection-point" key={`${title}-${index}`}>
            <p>{item.text}</p>
            <details>
              <summary>查看对应画像与原话</summary>
              {item.insightIds.map((id) => {
                const source = byId.get(id);
                return source && <div className="reflection-source" key={id}>
                  <strong>{source.statement}</strong>
                  {source.quotes.map((quote, quoteIndex) => <blockquote key={`${id}-${quoteIndex}`}>“{quote}”</blockquote>)}
                </div>;
              })}
            </details>
          </article>
        ))}
      </section>
    );
  }

  return (
    <section className="profile-reflection" aria-labelledby="reflection-heading">
      <div className="reflection-heading">
        <div>
          <h2 id="reflection-heading">AI 帮我整理</h2>
          <p>根据已确认的记忆生成一份观察草稿。</p>
        </div>
        <button type="button" onClick={() => void generate()} disabled={busy || sources.length === 0}>
          {busy ? "正在整理…" : current ? "重新整理" : "开始整理"}
        </button>
      </div>
      <details className="simple-more"><summary>使用说明</summary><p className="simple-note">最多 20 条已确认记忆及原话会发送给 DeepSeek。结果是临时草稿，不会保存成画像或用于聊天。</p></details>
      {sources.length === 0 && <p className="reflection-empty">先记住一条有原话依据的记忆。</p>}
      {error && <div className="error-notice" role="alert">{error}</div>}
      {result && !current && <p className="reflection-empty">画像已变化，旧观察不再显示。需要时可重新生成。</p>}
      {current && <>
        <p className="simple-note">这是 AI 草稿，请核对原话。</p>
        <div className="reflection-grid">
          {column("可能的优势", current.strengths, "依据不足，暂不判断。")}
          {column("可改善的方向", current.growthAreas, "依据不足，暂不判断。")}
          {column("需要核对", current.tensions, "暂无需要核对的内容。")}
        </div>
      </>}
    </section>
  );
}
