"use client";

import { useState, type FormEvent } from "react";
import type { Conversation } from "@/lib/chat/store";
import { requestProfileCandidates } from "@/lib/profile/api";
import { useProfileData } from "@/lib/profile/client";
import type { CognitiveDimension, ProfileInsight } from "@/types/cognitive";

const dimensionLabels: Record<CognitiveDimension, string> = {
  personality: "人格特质",
  cognitive_architecture: "认知架构",
  values_and_beliefs: "价值观与信念",
  behavioral_patterns: "行为模式",
  knowledge_structure: "知识结构",
  social_relations: "社会关系",
  narrative_self: "叙事自我",
};

const statusLabels: Record<ProfileInsight["status"], string> = {
  candidate: "待确认",
  confirmed: "已确认",
  rejected: "已驳回",
};

export function ProfileReviewPanel({
  conversation,
  busy,
}: {
  conversation: Conversation | null;
  busy: boolean;
}) {
  const {
    state, ready, error, addCandidates, confirm, reject, edit, deleteInsight, resetProfile,
  } = useProfileData();
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const items = (state?.insights ?? []).filter((insight) =>
    insight.evidence.some((source) => source.conversationId === conversation?.id)
  );
  const hasUserMessage = conversation?.messages.some((message) => message.role === "user") ?? false;

  async function analyze() {
    if (!conversation || analyzing || busy) return;
    setAnalyzing(true);
    setAnalysisError(null);
    setAnalysisMessage(null);
    try {
      const candidates = await requestProfileCandidates(conversation);
      const added = addCandidates(candidates);
      if (added !== null) {
        setAnalysisMessage(added > 0
          ? `提出 ${added} 条新候选，请查看证据并逐条审核。`
          : "这段对话暂无新的、证据充分的候选画像。");
      }
    } catch (failure) {
      setAnalysisError(failure instanceof Error ? failure.message : "画像提取失败，请稍后重试。");
    } finally {
      setAnalyzing(false);
    }
  }

  function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;
    if (edit(editingId, draft)) {
      setEditingId(null);
      setDraft("");
      setAnalysisMessage("描述已修改，请重新确认后才会用于聊天。");
    }
  }

  function remove(id: string) {
    if (window.confirm("删除这条画像洞察及其引用？此操作无法撤销。")) {
      deleteInsight(id);
    }
  }

  function clearProfile() {
    if (window.confirm("清空当前浏览器里的全部画像洞察？此操作无法撤销。")) {
      resetProfile();
    }
  }

  return (
    <details className="profile-review" open={error ? true : undefined}>
      <summary>画像候选与审核 · {items.length} 条</summary>
      <div className="profile-review-body">
        <p>点击提取后，这段对话的用户消息会传给 DeepSeek。请核对每条推测与原话；只有确认的内容才参与以后回答。</p>
        <button
          type="button"
          className="profile-analyze-button"
          onClick={() => void analyze()}
          disabled={!ready || !!error || !hasUserMessage || analyzing || busy}
        >
          {analyzing ? "正在提取…" : "从这段对话提取候选"}
        </button>
        {!hasUserMessage && <p className="profile-muted">先发送一条消息，再提取候选。</p>}
        {error && (
          <div className="error-notice" role="alert">
            {error}{" "}
            <button type="button" className="text-button" onClick={clearProfile}>明确清空本地画像</button>
          </div>
        )}
        {analysisError && <div className="error-notice" role="alert">{analysisError}</div>}
        {analysisMessage && <p role="status" className="profile-muted">{analysisMessage}</p>}
        {items.map((item) => (
          <article className="profile-insight" key={item.id}>
            <div className="profile-insight-meta">
              <span>{dimensionLabels[item.dimension]}</span>
              <span>{statusLabels[item.status]}</span>
              <span>{item.origin === "ai_inference" ? "AI 推测" : "用户修改"}</span>
            </div>
            {editingId === item.id ? (
              <form onSubmit={saveEdit} className="profile-edit-form">
                <label htmlFor={`profile-edit-${item.id}`}>修改画像描述</label>
                <textarea
                  id={`profile-edit-${item.id}`}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  maxLength={500}
                />
                <div className="profile-actions">
                  <button type="submit" disabled={!draft.trim()}>保存并重新审核</button>
                  <button type="button" onClick={() => setEditingId(null)}>取消</button>
                </div>
              </form>
            ) : (
              <p className="profile-insight-statement">{item.statement}</p>
            )}
            <div className="profile-evidence">
              <strong>对话依据</strong>
              {item.evidence.map((source) => (
                <blockquote key={`${source.conversationId}-${source.messageId}-${source.excerpt}`}>
                  “{source.excerpt}”
                </blockquote>
              ))}
            </div>
            <div className="profile-actions">
              {editingId !== item.id && item.status !== "confirmed" && (
                <button type="button" onClick={() => confirm(item.id)}>确认</button>
              )}
              {editingId !== item.id && item.status !== "rejected" && (
                <button type="button" onClick={() => reject(item.id)}>驳回</button>
              )}
              {editingId !== item.id && (
                <button type="button" onClick={() => { setEditingId(item.id); setDraft(item.statement); }}>
                  修改
                </button>
              )}
              {editingId !== item.id && <button type="button" onClick={() => remove(item.id)}>删除</button>}
            </div>
          </article>
        ))}
      </div>
    </details>
  );
}
