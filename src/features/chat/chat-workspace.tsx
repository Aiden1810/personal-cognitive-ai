"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { getSavedConversation, useChatData } from "@/lib/chat/client";
import { requestAssistantReply } from "@/lib/chat/api";
import { useProfileData } from "@/lib/profile/client";
import { useGoalData } from "@/lib/goals/client";
import { usableProfileInsights } from "@/lib/profile/usable";
import { ProfileReviewPanel } from "@/features/profile/profile-review-panel";
import type { ChatMessage } from "@/lib/chat/store";
import { getSavedAutoProfileState, useAutoProfileData } from "@/lib/profile/auto-client";
import { shouldAutoExtract } from "@/lib/profile/auto";
import { requestProfileCandidates } from "@/lib/profile/api";
import type { ChatContextSelection } from "@/lib/chat/context";
import { ChatContextPanel, type ContextRequestPhase } from "./chat-context-panel";
import { useResponsePreferences } from "@/lib/preferences/client";
import { ResponsePreferencePanel } from "./response-preferences";
import { ConversationListItem } from "./conversation-list-item";
import { ChatMessageContent } from "./message-content";

export function ChatWorkspace() {
  const {
    state,
    ready,
    error,
    createConversation,
    appendMessage,
    deleteConversation,
    reset,
  } = useChatData();
  const {
    state: profileState,
    ready: profileReady,
    error: profileError,
    removeByConversation,
    resetProfile,
    addCandidates,
    skipQuestionnaire,
  } = useProfileData();
  const auto = useAutoProfileData();
  const preferences = useResponsePreferences();
  const { state: goalState, ready: goalReady, error: goalError } = useGoalData();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<{ id: string; message: string } | null>(null);
  const [copyStatus, setCopyStatus] = useState<{ id: string; text: string } | null>(null);
  const [autoMessage, setAutoMessage] = useState<{ id: string; message: string; error: boolean } | null>(null);
  const [autoBusy, setAutoBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [referencesOpen, setReferencesOpen] = useState(false);
  const [requestContexts, setRequestContexts] = useState<Record<string, {
    messageId: string;
    selection: ChatContextSelection;
    phase: ContextRequestPhase;
  }>>({});
  const pendingRef = useRef(false);
  const autoPendingRef = useRef(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const messageAreaRef = useRef<HTMLDivElement>(null);
  const referencesButtonRef = useRef<HTMLButtonElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const conversations = state?.conversations ?? [];
  const visibleConversations = conversations.filter((item) => item.messages.length > 0);
  const pendingMemories = (profileState?.insights ?? []).filter((item) => item.status === "candidate").length;
  const selected =
    conversations.find((item) => item.id === selectedId) ??
    conversations[0] ??
    null;
  const latestContext = selected ? requestContexts[selected.id] : undefined;

  useEffect(() => {
    const area = messageAreaRef.current;
    if (area) area.scrollTop = area.scrollHeight;
  }, [selected?.id, selected?.messages.length]);

  function startConversation() {
    if (pendingRef.current) return;
    const created = conversations.find((item) => item.messages.length === 0) ?? createConversation();
    if (created) setSelectedId(created.id);
  }

  async function runAutoExtraction(id: string) {
    if (autoPendingRef.current || profileError) return;
    let current;
    let settings;
    try { current = getSavedConversation(id); settings = getSavedAutoProfileState(); }
    catch (failure) {
      setAutoMessage({ id, message: failure instanceof Error ? failure.message : "读取对话失败。", error: true });
      return;
    }
    if (!current || !shouldAutoExtract(current, settings)) return;
    autoPendingRef.current = true;
    setAutoBusy(true);
    setAutoMessage({ id, message: "正在整理新的画像候选…", error: false });
    try {
      const candidates = await requestProfileCandidates(current, undefined, profileState?.insights ?? []);
      const added = addCandidates(candidates);
      if (added === null) throw new Error("画像候选保存失败，请检查本地画像数据。");
      if (!auto.markProcessed(current)) throw new Error("自动提取检查点保存失败，请检查浏览器存储。");
      setAutoMessage({ id, message: added ? `新增 ${added} 条记忆待确认。` : "这次没有新记忆。", error: false });
    } catch (failure) {
      setAutoMessage({ id, message: failure instanceof Error ? failure.message : "自动提取失败，请稍后重试。", error: true });
    } finally { autoPendingRef.current = false; setAutoBusy(false); }
  }

  async function fetchReply(id: string, messages: ChatMessage[]) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPendingId(id);
    setReplyError(null);
    const messageId = messages.at(-1)?.id ?? "";
    function markContext(phase: ContextRequestPhase) {
      setRequestContexts((previous) => previous[id]?.messageId === messageId
        ? { ...previous, [id]: { ...previous[id], phase } }
        : previous);
    }
    try {
      const insights = usableProfileInsights(profileState?.insights ?? [], conversations);
      const goals = (goalState?.goals ?? []).filter((goal) => goal.status === "active");
      const reply = await requestAssistantReply(messages, insights, goals, undefined, (selection) => {
        setRequestContexts((previous) => ({ ...previous, [id]: { messageId, selection, phase: "pending" } }));
      }, preferences.state?.preferences, false, preferences.state?.personalContext);
      const savedReply = appendMessage(id, "assistant", reply);
      if (!savedReply) throw new Error("AI 回复未能保存，请检查浏览器存储后重试。");
      markContext("complete");
      void runAutoExtraction(id);
    } catch (failure) {
      markContext("failed");
      setReplyError({
        id,
        message: failure instanceof Error ? failure.message : "AI 回复失败，请稍后重试。",
      });
    } finally {
      pendingRef.current = false;
      setPendingId(null);
    }
  }

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim() || pendingRef.current || !profileReady || !!profileError || !goalReady || !!goalError || !preferences.ready || !!preferences.error) return;
    let id = selected?.id;
    let history = selected?.messages ?? [];
    if (!id) {
      const created = createConversation();
      if (!created) return;
      id = created.id;
      history = [];
      setSelectedId(id);
    }
    const saved = appendMessage(id, "user", draft);
    if (!saved) return;
    setDraft("");
    void fetchReply(id, [...history, saved]);
  }

  function retryReply() {
    if (!selected || pendingRef.current || !goalReady || !!goalError || !preferences.ready || !!preferences.error) return;
    void fetchReply(selected.id, selected.messages);
  }

  async function copyReply(message: ChatMessage) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopyStatus({ id: message.id, text: "已复制" });
    } catch {
      setCopyStatus({ id: message.id, text: "复制失败，请手动选中文字" });
    }
  }

  function removeConversation(id: string) {
    const target = conversations.find((item) => item.id === id);
    if (!target || pendingRef.current) return;
    if (window.confirm(`删除“${target.title}”及其消息和关联画像？此操作无法撤销。`)) {
      if (deleteConversation(id)) {
        removeByConversation(id);
        auto.forgetConversation(id);
        if (selected?.id === id) { setSelectedId(null); setDraft(""); }
        setRequestContexts((previous) => {
          const next = { ...previous };
          delete next[id];
          return next;
        });
      }
    }
  }

  function resetChats() {
    if (pendingRef.current) return;
    if (window.confirm("清空这个浏览器里的所有知衡对话？此操作无法撤销。")) {
      if (reset()) {
        resetProfile();
        auto.resetCheckpoints();
        setSelectedId(null);
        setDraft("");
      }
    }
  }

  return (
    <section className="chat-workspace" aria-label="知衡对话">
      <AppSidebar className="chat-sidebar">
        <div className="chat-threads" role="region" aria-label="对话列表">
          <div className="chat-threads-header">
            <button
              className="chat-new-button"
              onClick={startConversation}
              disabled={!ready || !!error || !!pendingId}
            >
              ＋ 新对话
            </button>
          </div>
          {!ready && (
            <p className="chat-muted" role="status">
              正在读取对话…
            </p>
          )}
          <div className="chat-thread-items">
            {visibleConversations.map((item) => (
              <ConversationListItem key={item.id} conversation={item} selected={selected?.id === item.id}
                disabled={!!pendingId} onSelect={setSelectedId} onDelete={removeConversation} />
            ))}
          </div>
        </div>
      </AppSidebar>

      <div className="chat-stage" onKeyDown={(event) => {
        if (event.key !== "Escape" || (!settingsOpen && !referencesOpen)) return;
        event.preventDefault();
        if (referencesOpen) referencesButtonRef.current?.focus();
        else settingsButtonRef.current?.focus();
        setReferencesOpen(false);
        setSettingsOpen(false);
      }}>
        <div className="chat-stage-header">
          <div>
            <h1>{selected?.messages.length ? selected.title : "新对话"}</h1>
          </div>
          <div className="chat-stage-actions">
            <button ref={referencesButtonRef} type="button" aria-controls="chat-reference-panel" aria-expanded={referencesOpen}
              onClick={() => { setReferencesOpen(!referencesOpen); setSettingsOpen(false); }}>
              参考资料
            </button>
            <button ref={settingsButtonRef} type="button" aria-controls="chat-settings-panel" aria-expanded={settingsOpen}
              onClick={() => { setSettingsOpen(!settingsOpen); setReferencesOpen(false); }}>
              对话设置
            </button>
          </div>
        </div>
        {ready && profileReady && goalReady && !error && !profileError && !goalError &&
          !profileState?.onboarding && !(profileState?.insights.length) && !(goalState?.goals.length) && visibleConversations.length === 0 &&
          <aside className="questionnaire-invitation" aria-label="初始问卷">
            <div><strong>先让知衡了解你的做事方式</strong><p>15 题建立可修改的初始画像，也可以直接开始聊天。</p></div>
            <Link href="/onboarding">填写初始问卷 ↗</Link><button type="button" className="text-button" onClick={skipQuestionnaire}>暂时跳过</button>
          </aside>}
        {error && (
          <div className="error-notice" role="alert">
            {error}{" "}
            <button type="button" className="text-button" onClick={resetChats}>
              明确清空全部本地对话
            </button>
          </div>
        )}
        {profileError && (
          <div className="error-notice" role="alert">
            本地画像读取失败：{profileError} 请打开“对话设置”里的“对话记忆”检查。
          </div>
        )}
        {goalError && (
          <div className="error-notice" role="alert">
            本地目标读取失败：{goalError} <Link href="/profile">到我的画像检查目标</Link>
          </div>
        )}
        {preferences.error && <div className="error-notice" role="alert">{preferences.error} 请检查个人设置，或从<Link href="/backup">备份</Link>恢复。</div>}
        {replyError && selected && replyError.id === selected.id && (
          <div className="error-notice" role="alert">{replyError.message} 你的消息已保留，可以重试。</div>
        )}
        {autoMessage?.error && selected?.id === autoMessage.id && <p className="error-notice auto-profile-message" role="alert">{autoMessage.message}</p>}
        <div className="chat-panels">
          <details className="chat-reference-panel" id="chat-reference-panel" open={referencesOpen}
            onToggle={(event) => setReferencesOpen(event.currentTarget.open)}>
          <summary onClick={() => { if (referencesOpen) referencesButtonRef.current?.focus(); }}>参考资料<span>收起</span></summary>
            <div className="chat-reference-body">
              {selected && latestContext ? (
                <ChatContextPanel
                  initiallyOpen
                  selection={latestContext.selection}
                  phase={latestContext.phase}
                  question={selected.messages.find((message) => message.id === latestContext.messageId)?.content ?? ""}
                  conversations={conversations}
                  currentInsights={usableProfileInsights(profileState?.insights ?? [], conversations)}
                  currentGoals={goalState?.goals ?? []}
                />
              ) : <p className="chat-context-note">发送消息后，可以在这里核对这次请求附带的画像、目标和个人设置。</p>}
              <Link className="chat-memory-link" href="/profile#personal-context">查看我的背景与回答要求 ↗</Link>
            </div>
          </details>
          <details className="chat-tools" id="chat-settings-panel" open={settingsOpen}
            onToggle={(event) => setSettingsOpen(event.currentTarget.open)}>
          <summary onClick={() => { if (settingsOpen) settingsButtonRef.current?.focus(); }}>对话设置<span>收起</span></summary>
            <div className="chat-tools-body">
              <ResponsePreferencePanel busy={!!pendingId} />
              <Link className="chat-memory-link" href="/profile#personal-context">个人背景与自定义回答要求 ↗</Link>
              <ProfileReviewPanel key={selected?.id ?? "empty"} conversation={selected} conversations={conversations} busy={!!pendingId || autoBusy} />
              {autoMessage && !autoMessage.error && selected?.id === autoMessage.id && <p className="chat-muted" role="status">{autoMessage.message}</p>}
              {pendingMemories > 0 && <Link className="chat-memory-link" href="/profile#pending-memories">到我的画像查看全部待确认记忆 ↗</Link>}
            </div>
          </details>
        </div>
        <div className="chat-message-area" aria-live="polite" ref={messageAreaRef}>
          <div className="chat-message-list">
            {!selected || selected.messages.length === 0 ? (
              <div className="chat-welcome">
                <h3>今天想聊些什么？</h3>
                <div className="chat-starters" aria-label="对话开场示例">
                  {["帮我梳理现在最重要的事", "我想复盘最近的一个选择", "陪我把这个问题想清楚"].map((prompt) => (
                    <button type="button" key={prompt} onClick={() => { setDraft(prompt); composerRef.current?.focus(); }} disabled={!ready || !!error}>
                      {prompt}<span aria-hidden="true">↗</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              selected.messages.map((message) => {
                const contextForMessage = selected && requestContexts[selected.id]?.messageId === message.id ? requestContexts[selected.id] : null;
                const memoryCount = contextForMessage ? (contextForMessage.selection.insights.length + contextForMessage.selection.goals.length) : 0;
                return (
                  <div className={`chat-message ${message.role}`} key={message.id}>
                    <span className="chat-message-role" aria-hidden="true">
                      {message.role === "user" ? "你" : <Image src="/icon.svg" alt="" width={30} height={30} />}
                    </span>
                    <div className="chat-message-content">
                      <span className="chat-message-label">
                        {message.role === "user" ? "你" : "知衡 · AI"}
                        {message.role === "assistant" && memoryCount > 0 && (
                          <span className="chat-memory-badge" title={`参考了 ${memoryCount} 条记忆`}>
                            参考 {memoryCount} 项
                          </span>
                        )}
                      </span>
                      <ChatMessageContent role={message.role} content={message.content} />
                      {message.role === "assistant" && (
                        <button type="button" className="chat-copy-button" onClick={() => void copyReply(message)}
                          aria-label="复制知衡的回复">
                          {copyStatus?.id === message.id ? copyStatus.text : "复制回复"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        {pendingId === selected?.id && <p className="chat-pending" role="status"><span className="chat-availability-dot" />知衡正在思考…</p>}
        {selected?.messages.at(-1)?.role === "user" && !pendingId && !error && (
          <button type="button" className="text-button chat-retry-button" onClick={retryReply}>
            重试回复
          </button>
        )}
        {pendingMemories > 0 && <aside className="chat-review-cue" aria-label="待审核记忆">
          <span>{pendingMemories} 条记忆待确认 · 审核后才会用于回答</span>
          <Link href="/profile#pending-memories">去审核 ↗</Link>
        </aside>}
        <form className="chat-composer" onSubmit={sendMessage}>
          <label htmlFor="chat-draft" className="sr-only">继续对话</label>
          <div className="chat-composer-box">
            <textarea
              ref={composerRef}
              id="chat-draft"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="写下想和知衡讨论的事…"
              disabled={!ready || !!error || !profileReady || !!profileError || !goalReady || !!goalError || !preferences.ready || !!preferences.error || !!pendingId}
              maxLength={10000}
            />
            <button type="submit" disabled={!draft.trim() || !ready || !!error || !profileReady || !!profileError || !goalReady || !!goalError || !preferences.ready || !!preferences.error || !!pendingId}>
              {pendingId ? "等待回复…" : "发送"}
            </button>
          </div>
          <div className="chat-composer-note">
            <span>Enter 发送 · Shift + Enter 换行</span>
            <span>{error ? "本地存储异常，请先处理上方提示" : "对话保存在当前浏览器"}</span>
          </div>
        </form>
      </div>
    </section>
  );
}
