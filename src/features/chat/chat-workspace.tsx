"use client";

import { useRef, useState, type FormEvent } from "react";
import { useChatData } from "@/lib/chat/client";
import { requestAssistantReply } from "@/lib/chat/api";
import { useProfileData } from "@/lib/profile/client";
import { usableProfileInsights } from "@/lib/profile/usable";
import { ProfileReviewPanel } from "@/features/profile/profile-review-panel";
import type { ChatMessage } from "@/lib/chat/store";

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
  } = useProfileData();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<{ id: string; message: string } | null>(null);
  const pendingRef = useRef(false);
  const conversations = state?.conversations ?? [];
  const selected =
    conversations.find((item) => item.id === selectedId) ??
    conversations[0] ??
    null;

  function startConversation() {
    if (pendingRef.current) return;
    const created = createConversation();
    if (created) setSelectedId(created.id);
  }

  async function fetchReply(id: string, messages: ChatMessage[]) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPendingId(id);
    setReplyError(null);
    try {
      const insights = usableProfileInsights(profileState?.insights ?? [], conversations);
      const reply = await requestAssistantReply(messages, insights);
      appendMessage(id, "assistant", reply);
    } catch (failure) {
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
    if (!draft.trim() || pendingRef.current || !profileReady || !!profileError) return;
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
    if (!selected || pendingRef.current) return;
    void fetchReply(selected.id, selected.messages);
  }

  function removeConversation() {
    if (!selected || pendingRef.current) return;
    if (window.confirm("删除这段对话及其中的所有消息？此操作无法撤销。")) {
      if (deleteConversation(selected.id)) {
        removeByConversation(selected.id);
        setSelectedId(null);
      }
    }
  }

  function resetChats() {
    if (pendingRef.current) return;
    if (window.confirm("清空这个浏览器里的所有知衡对话？此操作无法撤销。")) {
      if (reset()) {
        resetProfile();
        setSelectedId(null);
        setDraft("");
      }
    }
  }

  return (
    <section className="chat-workspace" aria-label="知衡对话">
      <aside className="chat-threads" aria-label="对话列表">
        <div className="chat-threads-header">
          <div>
            <span className="chat-kicker">YOUR SPACE</span>
            <h1>我的对话</h1>
          </div>
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
        {ready && conversations.length === 0 && (
          <p className="chat-empty-list">还没有对话。从右侧写下第一句话。</p>
        )}
        <div className="chat-thread-items">
          {conversations.map((item) => (
            <button
              className={`chat-thread-item ${selected?.id === item.id ? "is-selected" : ""}`}
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              disabled={!!pendingId}
              aria-current={selected?.id === item.id ? "true" : undefined}
            >
              <span>{item.title}</span>
              <small>{item.messages.length} 条消息</small>
            </button>
          ))}
        </div>
        <p className="chat-storage-note">对话目前只保存在这个浏览器中。</p>
      </aside>

      <div className="chat-stage">
        <div className="chat-stage-header">
          <div>
            <span className="chat-kicker">ZHIHENG / CONVERSATION</span>
            <h2>{selected?.title ?? "从一次对话开始"}</h2>
          </div>
          {selected && (
            <button className="text-button" onClick={removeConversation} disabled={!!pendingId}>
              删除对话
            </button>
          )}
        </div>
        <div className="chat-availability" role="note">
          <span className="chat-availability-dot" aria-hidden="true" />
          AI 对话需要本机配置 DeepSeek API Key；画像候选可手动提取和审核，自动持续学习尚未接入。
        </div>
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
            本地画像读取失败：{profileError} 请展开画像审核区检查或清空。
          </div>
        )}
        {replyError && selected && replyError.id === selected.id && (
          <div className="error-notice" role="alert">{replyError.message} 你的消息已保留，可以重试。</div>
        )}
        <ProfileReviewPanel conversation={selected} busy={!!pendingId} />
        <div className="chat-message-area" aria-live="polite">
          {!selected || selected.messages.length === 0 ? (
            <div className="chat-welcome">
              <div className="chat-welcome-mark" aria-hidden="true">
                知
              </div>
              <p className="chat-kicker">A PLACE TO THINK OUT LOUD</p>
              <h3>从你的想法开始。</h3>
              <p>
                写下你想聊的事。配置 DeepSeek API Key 后，知衡会在这里回复。
              </p>
            </div>
          ) : (
            selected.messages.map((message) => (
              <div className={`chat-message ${message.role}`} key={message.id}>
                <span className="chat-message-role">
                  {message.role === "user" ? "我" : "知衡"}
                </span>
                <p>{message.content}</p>
              </div>
            ))
          )}
        </div>
        {pendingId === selected?.id && <p role="status">知衡正在回复…</p>}
        {selected?.messages.at(-1)?.role === "user" && !pendingId && !error && (
          <button type="button" className="text-button" onClick={retryReply}>
            重试回复
          </button>
        )}
        <form className="chat-composer" onSubmit={sendMessage}>
          <label htmlFor="chat-draft">写下你想说的</label>
          <div className="chat-composer-box">
            <textarea
              id="chat-draft"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="写下想和知衡讨论的事…"
              disabled={!ready || !!error || !profileReady || !!profileError || !!pendingId}
              maxLength={10000}
            />
            <button type="submit" disabled={!draft.trim() || !ready || !!error || !profileReady || !!profileError || !!pendingId}>
              {pendingId ? "等待回复…" : "发送 ↗"}
            </button>
          </div>
          <p>
            发送后，这段对话会传给 DeepSeek 生成回复，并保存在当前浏览器。请勿录入真实敏感资料。
          </p>
        </form>
      </div>
    </section>
  );
}
