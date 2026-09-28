"use client";

import { useState, type FormEvent } from "react";
import { useChatData } from "@/lib/chat/client";

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const conversations = state?.conversations ?? [];
  const selected =
    conversations.find((item) => item.id === selectedId) ??
    conversations[0] ??
    null;

  function startConversation() {
    const created = createConversation();
    if (created) setSelectedId(created.id);
  }

  function saveMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim()) return;
    let id = selected?.id;
    if (!id) {
      const created = createConversation();
      if (!created) return;
      id = created.id;
      setSelectedId(id);
    }
    if (appendMessage(id, "user", draft)) setDraft("");
  }

  function removeConversation() {
    if (!selected) return;
    if (window.confirm("删除这段对话及其中的所有消息？此操作无法撤销。")) {
      if (deleteConversation(selected.id)) setSelectedId(null);
    }
  }

  function resetChats() {
    if (window.confirm("清空这个浏览器里的所有知衡对话？此操作无法撤销。")) {
      if (reset()) {
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
            disabled={!ready || !!error}
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
            <button className="text-button" onClick={removeConversation}>
              删除对话
            </button>
          )}
        </div>
        <div className="chat-availability" role="note">
          <span className="chat-availability-dot" aria-hidden="true" />
          当前阶段：保存对话已可用；AI 回复、自动记忆和个人画像尚未接入。
        </div>
        {error && (
          <div className="error-notice" role="alert">
            {error}{" "}
            <button type="button" className="text-button" onClick={resetChats}>
              明确清空全部本地对话
            </button>
          </div>
        )}
        <div className="chat-message-area" aria-live="polite">
          {!selected || selected.messages.length === 0 ? (
            <div className="chat-welcome">
              <div className="chat-welcome-mark" aria-hidden="true">
                知
              </div>
              <p className="chat-kicker">A PLACE TO THINK OUT LOUD</p>
              <h3>从你的想法开始。</h3>
              <p>
                写下你想聊的事。现在可以保存自己的对话内容；接入模型后，知衡会在这里回复。
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
        <form className="chat-composer" onSubmit={saveMessage}>
          <label htmlFor="chat-draft">写下你想说的</label>
          <div className="chat-composer-box">
            <textarea
              id="chat-draft"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="先记录一段想法…"
              disabled={!ready || !!error}
              maxLength={10000}
            />
            <button type="submit" disabled={!draft.trim() || !ready || !!error}>
              保存消息 ↗
            </button>
          </div>
          <p>
            当前按钮只保存你的文字，不会发送给 AI 服务。请勿录入真实敏感资料。
          </p>
        </form>
      </div>
    </section>
  );
}
