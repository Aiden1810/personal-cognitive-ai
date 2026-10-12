"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { useChatData } from "@/lib/chat/client";
import { useGoalData } from "@/lib/goals/client";
import { useProfileData } from "@/lib/profile/client";
import { useOutcomeData } from "@/lib/outcomes/client";
import { usableProfileInsights } from "@/lib/profile/usable";
import type { Conversation } from "@/lib/chat/store";
import type { ChatSuggestion } from "@/lib/chat/suggestions";
import type { SuggestionConfirmation } from "@/lib/chat/actions";
import type { UserGoal } from "@/types/cognitive";
import { PROFILE_DIMENSIONS } from "@/lib/profile/overview";
import { GoalEditor } from "@/features/profile/goal-editor";
import { OutcomeEditor } from "@/features/outcomes/outcome-editor";

const labels = {
  goal: { title: "建议设定一个目标", button: "查看目标草稿" },
  archive: { title: "这条记忆可能需要更新", button: "查看并归档这条记忆" },
  outcome: { title: "记录这次行动", button: "记录这次行动" },
};

export function ChatSuggestionCard({ suggestion, conversationId, messageId, conversations, busy }: {
  suggestion: ChatSuggestion;
  conversationId: string;
  messageId: string;
  conversations: Conversation[];
  busy: boolean;
}) {
  const chat = useChatData();
  const goals = useGoalData();
  const profile = useProfileData();
  const outcomes = useOutcomeData();
  const [editing, setEditing] = useState(false);
  const [expectedGoal, setExpectedGoal] = useState<UserGoal | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const confirming = useRef(false);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const handledRef = useRef<HTMLParagraphElement>(null);
  const wasEditing = useRef(false);
  const label = labels[suggestion.kind];
  const existingGoal = suggestion.kind === "goal" ? goals.state?.goals.find((item) => item.dimension === suggestion.dimension) : undefined;
  const archiveTarget = suggestion.kind === "archive" ? usableProfileInsights(profile.state?.insights ?? [], conversations)
    .find((item) => item.id === suggestion.insightId && item.statement === suggestion.insightStatement) : undefined;
  const outcomeTarget = suggestion.kind === "outcome" ? goals.state?.goals
    .find((item) => item.id === suggestion.goalId && item.status === "active" && item.intention === suggestion.goalIntention) : undefined;
  const dataError = suggestion.kind === "archive" ? profile.error : suggestion.kind === "outcome" ? goals.error ?? outcomes.error : goals.error;
  const ready = suggestion.kind === "archive" ? profile.ready : suggestion.kind === "outcome" ? goals.ready && outcomes.ready : goals.ready;
  const stale = suggestion.kind === "archive" ? !archiveTarget : suggestion.kind === "outcome" ? !outcomeTarget : false;
  const reviewing = editing && suggestion.status === "pending";

  useLayoutEffect(() => {
    if (wasEditing.current && !reviewing) {
      const opener = openButtonRef.current;
      const target = opener && !opener.disabled ? opener : handledRef.current ?? cardRef.current;
      target?.focus({ preventScroll: true });
    }
    wasEditing.current = reviewing;
  }, [reviewing]);

  function close() { setEditing(false); setFailure(null); }
  function open() { setExpectedGoal(existingGoal ? { ...existingGoal } : null); setFailure(null); setEditing(true); }
  function dismiss() {
    setFailure(null);
    try { chat.dismissSuggestion(conversationId, messageId, suggestion.id); }
    catch (error) { setFailure(error instanceof Error ? error.message : "忽略建议未能保存，请重试。"); }
  }
  function confirm(confirmation: SuggestionConfirmation) {
    if (busy || confirming.current) return null;
    confirming.current = true;
    setFailure(null);
    try {
      const saved = chat.confirmSuggestion(conversationId, messageId, suggestion.id, confirmation);
      setEditing(false);
      return saved;
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "保存失败，请重新核对。");
      return null;
    } finally { confirming.current = false; }
  }

  if (suggestion.status !== "pending") return <p ref={handledRef} tabIndex={-1} className="chat-suggestion-handled" role="status">
    {suggestion.status === "dismissed" ? "已忽略这条建议" : suggestion.kind === "goal" ? "目标已保存" : suggestion.kind === "archive" ? "旧记忆已归档" : "行动已保存"}
    {suggestion.status === "completed" && <Link href={suggestion.kind === "outcome" ? "/progress" : "/profile"}>查看 ↗</Link>}
  </p>;

  return <article ref={cardRef} tabIndex={-1} className="chat-suggestion-card" aria-label={label.title}>
    <header><span>AI 操作建议 · 待确认</span><h3>{label.title}</h3></header>
    <p className="chat-suggestion-main">{suggestion.kind === "goal" ? suggestion.intention : suggestion.kind === "archive" ? suggestion.insightStatement : suggestion.action}</p>
    <p className="chat-suggestion-reason">{suggestion.reason}</p>
    <details className="chat-suggestion-source"><summary>查看这次建议的依据</summary><blockquote>“{suggestion.excerpt}”</blockquote></details>
    {dataError && <p className="error-notice" role="alert">{dataError}</p>}
    {ready && stale && !dataError && <p className="chat-suggestion-notice">关联记录已改变或不再可用，请到<Link href="/profile">我的画像</Link>重新核对。</p>}
    {failure && <p className="error-notice" role="alert">{failure}</p>}
    {editing ? <fieldset className="chat-suggestion-review" aria-label="确认操作建议" disabled={busy || !ready || !!dataError || stale}>
      {suggestion.kind === "goal" && <>
        <p className="chat-suggestion-notice">{PROFILE_DIMENSIONS[suggestion.dimension].label} · {expectedGoal
          ? `这个维度已有目标：“${expectedGoal.intention}”。确认保存将替换它的文字${expectedGoal.status === "paused" ? "，并保持暂停" : ""}。`
          : "可修改草稿，确认后才创建目标。"}</p>
        <GoalEditor dimension={suggestion.dimension} goal={expectedGoal ?? undefined} initialIntention={suggestion.intention}
          idPrefix={"suggested-goal-" + suggestion.id} startEditing saveLabel={expectedGoal ? "确认更新目标" : "确认创建目标"}
          onSave={(_dimension, intention, willingness, targetLevel) => {
            const saved = confirm({ kind: "goal", intention, willingness, targetLevel, expectedGoal });
            return typeof saved === "object" ? saved : null;
          }} onPause={() => {}} onResume={() => {}} onDelete={() => {}} onClose={close} />
      </>}
      {suggestion.kind === "archive" && archiveTarget && <>
        <strong>旧记忆的原话</strong>
        {archiveTarget.evidence.map((source) => <blockquote key={source.excerpt}>“{source.excerpt}”</blockquote>)}
        <strong>你这次说</strong><blockquote>“{suggestion.excerpt}”</blockquote>
        <p className="chat-suggestion-notice">请核对旧记忆是否仍适用。归档后不再用于当前画像和回答；原始依据保留，可在我的画像重新启用。这次的新说法不会自动成为已确认记忆。</p>
        <div className="profile-actions"><button type="button" onClick={() => confirm({ kind: "archive" })}>确认归档旧记忆</button></div>
      </>}
      {suggestion.kind === "outcome" && outcomeTarget && <>
        <p className="chat-suggestion-notice">对应目标：{outcomeTarget.intention}</p>
        <OutcomeEditor goal={outcomeTarget} initialAction={suggestion.action} initialResult={suggestion.result}
          idPrefix={"suggested-outcome-" + suggestion.id} onSave={(_goal, action, result, rating) => !!confirm({ kind: "outcome", action, result, rating })} onCancel={close} />
      </>}
    </fieldset> : <div className="profile-actions">
      <button ref={openButtonRef} type="button" onClick={open} disabled={busy || !ready || !!dataError || stale}>{label.button}</button>
      <button type="button" onClick={dismiss} disabled={busy}>忽略建议</button>
    </div>}
    {editing && (suggestion.kind === "archive" || stale || !!dataError) && <button type="button" className="text-button" onClick={close}>取消</button>}
  </article>;
}
