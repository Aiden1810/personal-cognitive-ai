"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import type { Conversation } from "@/lib/chat/store";
import { getSavedConversation } from "@/lib/chat/client";
import { requestProfileCandidates } from "@/lib/profile/api";
import { useProfileData } from "@/lib/profile/client";
import type { ProfileInsight, ProfileScope } from "@/types/cognitive";
import { getExtractionContext } from "@/lib/profile/context";
import { useAutoProfileData } from "@/lib/profile/auto-client";
import { PROFILE_DIMENSIONS } from "@/lib/profile/overview";
import { ProfileRecordInfo, ProfileScopeField } from "./profile-record-info";
import { MemoryUpdateReview } from "./memory-update-review";

const statusLabels: Record<ProfileInsight["status"], string> = {
  candidate: "待确认",
  confirmed: "已确认",
  rejected: "已驳回",
  archived: "已归档 · 非当前画像",
};

export function ProfileReviewPanel({
  conversation,
  conversations,
  busy,
  openRequest = 0,
}: {
  conversation: Conversation | null;
  conversations: Conversation[];
  busy: boolean;
  openRequest?: number;
}) {
  const {
    state, ready, error, errorCode, retryLoad, addCandidates, confirm, reject, edit, deleteInsight, resetProfile,
  } = useProfileData();
  const auto = useAutoProfileData();
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [draftScope, setDraftScope] = useState<ProfileScope | "">("");
  const panelRef = useRef<HTMLDetailsElement>(null);
  const analyzeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (openRequest && panelRef.current) {
      panelRef.current.open = true;
      const target = analyzeRef.current?.disabled ? panelRef.current.querySelector("summary") : analyzeRef.current;
      target?.focus({ preventScroll: true });
    }
  }, [openRequest]);
  const items = (state?.insights ?? []).filter((insight) =>
    insight.status === "candidate" && insight.evidence.some((source) => source.kind !== "questionnaire" && source.conversationId === conversation?.id)
  );
  const scope = getExtractionContext(conversation, state?.insights ?? []);
  const hasUserMessage = scope.messages.length > 0;

  async function analyze() {
    if (!conversation || analyzing || busy) return;
    setAnalyzing(true);
    setAnalysisError(null);
    setAnalysisMessage(null);
    try {
      const candidates = await requestProfileCandidates(conversation, undefined, state?.insights ?? []);
      if (!getSavedConversation(conversation.id)) throw new Error("原对话已删除，本次整理结果未保存。");
      const added = addCandidates(candidates);
      if (added === null) throw new Error("整理结果未能保存，请处理本地资料错误后重试。");
      if (added !== null) {
        const processed = auto.markProcessed(conversation);
        const result = added > 0
          ? `发现 ${added} 条新记忆，请核对原话后确认。`
          : "这次没有发现新记忆。";
        setAnalysisMessage(processed ? result : `${result} 自动整理进度未保存，请重试读取设置。`);
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
    if (edit(editingId, draft, draftScope || null)) {
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
    <details className="profile-review" ref={panelRef} open={error ? true : undefined}>
      <summary>对话记忆{items.length > 0 ? ` · ${items.length} 条待确认` : ""}</summary>
      <div className="profile-review-body">
        <p>从近期对话整理记忆，确认后用于后续回答。</p>
        <details className="memory-use-details">
          <summary>使用范围</summary>
          <p className="profile-muted">近期发言和相关记忆会发送给 DeepSeek，用于整理新发现；只有你确认的记忆才用于个性化回答。对话和记忆保存在当前浏览器，可到资料备份导出。</p>
          <p className="profile-muted">
            下次提取将读取最近 {scope.messages.length} 条用户发言，共 {scope.totalUserMessages} 条；
            {scope.omittedUserMessages > 0 ? `较早的 ${scope.omittedUserMessages} 条未包含。` : "当前用户发言已全部包含。"}
            最多读取 20 条、合计 2 万字，助手回复不参与。
            另参考 {scope.existingInsights.length} 条相关已有候选与审核记录（最多 30 条）。
          </p>
          <p className="profile-muted">自动整理开启后，每新增 4 条用户发言，会在回复完成后按上述范围整理；新发现仍需要你确认。</p>
        </details>
        <label className="auto-profile-toggle">
          <input type="checkbox" checked={auto.state?.enabled ?? false} disabled={!auto.ready || !!auto.error}
            onChange={(event) => auto.setEnabled(event.target.checked, conversations)} />
          <span><strong>自动整理新记忆</strong><small>将近期发言发送给 DeepSeek 整理，结果待你确认。</small></span>
        </label>
        {auto.error && <div className="error-notice" role="alert">{auto.error} 自动提取已暂停。 <button type="button" className="text-button" onClick={auto.retryLoad}>重试读取设置</button></div>}
        <button
          type="button"
          className="profile-analyze-button"
          ref={analyzeRef}
          onClick={() => void analyze()}
          disabled={!ready || !!error || !hasUserMessage || analyzing || busy}
        >
          {analyzing ? "正在整理…" : "整理这段对话"}
        </button>
        <Link href="/profile" className="chat-memory-link">管理我的画像 ↗</Link>
        {error && (
          <div className="error-notice" role="alert">
            {error}{" "}
            <button type="button" className="text-button" onClick={retryLoad}>重试读取画像</button>
            {errorCode === "INVALID_STORED_DATA" && <button type="button" className="text-button" onClick={clearProfile}>明确清空本地画像</button>}
          </div>
        )}
        {analysisError && <div className="error-notice" role="alert">{analysisError} <button type="button" className="text-button" disabled={!ready || !!error || !hasUserMessage || analyzing || busy} onClick={() => void analyze()}>重试整理</button></div>}
        {analysisMessage && <p role="status" className="profile-muted">{analysisMessage}</p>}
        {items.map((item) => (
          <article className="profile-insight" key={item.id}>
            <div className="profile-insight-meta">
              <span>{PROFILE_DIMENSIONS[item.dimension].label}</span>
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
                <ProfileScopeField value={draftScope} onChange={setDraftScope} />
                <p className="profile-muted">只写有依据的情境、行为与结果；一次经历不等于长期习惯。</p>
                <div className="profile-actions">
                  <button type="submit" disabled={!draft.trim()}>保存并重新审核</button>
                  <button type="button" onClick={() => setEditingId(null)}>取消</button>
                </div>
              </form>
            ) : (
              <p className="profile-insight-statement">{item.statement}</p>
            )}
            <ProfileRecordInfo item={item} conversations={conversations} />
            <div className="profile-evidence">
              <strong>对话依据</strong>
              {item.evidence.map((source) => (
                <blockquote key={source.excerpt}>
                  “{source.excerpt}”
                </blockquote>
              ))}
            </div>
            <div className="profile-actions">
              {editingId !== item.id && (
                <button type="button" onClick={() => confirm(item.id)}>记住</button>
              )}
              {editingId !== item.id && (
                <button type="button" onClick={() => reject(item.id)}>忽略</button>
              )}
              {editingId !== item.id && (
                <button type="button" onClick={() => { setEditingId(item.id); setDraft(item.statement); setDraftScope(item.scope ?? ""); }}>
                  修改
                </button>
              )}
              {editingId !== item.id && <button type="button" onClick={() => remove(item.id)}>删除</button>}
            </div>
            {editingId !== item.id && <MemoryUpdateReview candidate={item} conversations={conversations} />}
          </article>
        ))}
      </div>
    </details>
  );
}
