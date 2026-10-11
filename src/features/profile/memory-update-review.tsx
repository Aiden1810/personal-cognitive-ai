"use client";

import { useState } from "react";
import { useProfileData } from "@/lib/profile/client";
import { hasIntactProfileEvidence } from "@/lib/profile/usable";
import type { Conversation } from "@/lib/chat/store";
import type { ProfileInsight } from "@/types/cognitive";

export function MemoryUpdateReview({ candidate, conversations }: { candidate: ProfileInsight; conversations: Conversation[] }) {
  const profile = useProfileData();
  const [previousId, setPreviousId] = useState("");
  const records = (profile.state?.insights ?? []).filter((item) => item.id !== candidate.id && item.dimension === candidate.dimension && item.status === "confirmed" && hasIntactProfileEvidence(item, conversations));
  const previous = records.find((item) => item.id === previousId);
  if (candidate.status !== "candidate" || !hasIntactProfileEvidence(candidate, conversations) || records.length === 0) return null;
  return <details className="memory-update-review">
    <summary>这是旧记忆的变化？核对后更新</summary>
    <p>由你选择需要更新的旧记录。这里列出同维度的已确认记录，不代表 AI 已判定冲突。不同情境的记录可以分别保留。</p>
    <label>要更新哪条旧记忆？
      <select value={previous?.id ?? ""} onChange={(event) => setPreviousId(event.target.value)}>
        <option value="">请选择，不会自动更新</option>
        {records.map((item) => <option key={item.id} value={item.id}>{item.statement}</option>)}
      </select>
    </label>
    {previous && <>
      <div className="memory-update-comparison">
        {[{ label: "原来的记忆 · 更新后归档", item: previous }, { label: "新的记忆 · 确认后用于回答", item: candidate }].map(({ label, item }) => <div key={item.id}>
          <strong>{label}</strong><p>{item.statement}</p>
          {item.evidence.map((source) => <blockquote key={source.excerpt}>“{source.excerpt}”</blockquote>)}
        </div>)}
      </div>
      <button type="button" onClick={() => profile.replace(previous.id, candidate.id)}>确认新记忆并归档旧记忆</button>
      <p>旧记录不再作为当前画像参考，也可重新审核启用。原话与原始聊天仍保留。</p>
    </>}
    {profile.error && <p className="error-notice" role="alert">{profile.error}</p>}
  </details>;
}
