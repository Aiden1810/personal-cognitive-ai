"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useChatData } from "@/lib/chat/client";
import { useProfileData } from "@/lib/profile/client";
import { buildProfileOverview, PROFILE_DIMENSIONS } from "@/lib/profile/overview";
import type { ProfileInsight } from "@/types/cognitive";

const statusLabels: Record<ProfileInsight["status"], string> = {
  candidate: "待确认",
  confirmed: "已确认",
  rejected: "已驳回",
};

export function ProfileOverview() {
  const chat = useChatData();
  const profile = useProfileData();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const conversations = chat.state?.conversations ?? [];
  const groups = buildProfileOverview(profile.state?.insights ?? [], conversations);
  const activeCount = groups.reduce((sum, group) => sum + group.active.length, 0);
  const pendingCount = groups.reduce((sum, group) => sum + group.pending.length, 0);
  const invalidCount = groups.reduce((sum, group) => sum + group.invalid.length, 0);

  function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editingId && profile.edit(editingId, draft)) {
      setEditingId(null);
      setDraft("");
    }
  }

  function remove(id: string) {
    if (window.confirm("删除这条画像洞察及其引用？此操作无法撤销。")) {
      profile.deleteInsight(id);
    }
  }

  function renderInsight(item: ProfileInsight, valid: boolean) {
    return (
      <article className="profile-overview-insight" key={item.id}>
        <div className="profile-insight-meta">
          <span>{valid ? statusLabels[item.status] : "来源已失效"}</span>
          <span>{item.origin === "ai_inference" ? "AI 推测" : "用户修改"}</span>
        </div>
        {editingId === item.id ? (
          <form onSubmit={saveEdit} className="profile-edit-form">
            <label htmlFor={`overview-edit-${item.id}`}>修改画像描述</label>
            <textarea
              id={`overview-edit-${item.id}`}
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
          {item.evidence.map((source) => {
            const title = conversations.find((conversation) => conversation.id === source.conversationId)?.title;
            return (
              <div key={`${source.conversationId}-${source.messageId}-${source.excerpt}`}>
                <small>{title ?? "原对话已删除"}</small>
                <blockquote>“{source.excerpt}”</blockquote>
              </div>
            );
          })}
        </div>
        {editingId !== item.id && (
          <div className="profile-actions">
            {valid && item.status !== "confirmed" &&
              <button type="button" onClick={() => profile.confirm(item.id)}>确认</button>}
            {valid && item.status !== "rejected" &&
              <button type="button" onClick={() => profile.reject(item.id)}>驳回</button>}
            {valid &&
              <button type="button" onClick={() => { setEditingId(item.id); setDraft(item.statement); }}>修改</button>}
            <button type="button" onClick={() => remove(item.id)}>删除</button>
          </div>
        )}
      </article>
    );
  }

  return (
    <section className="profile-overview" aria-labelledby="profile-title">
      <header className="page-heading">
        <p className="eyebrow">ZHIHENG / PROFILE</p>
        <h1 id="profile-title">我的当前画像</h1>
        <p className="page-description">
          七个维度用于整理资料，不是人格分数。这里展示你审核过的内容和仍待核对的推测；资料不足就保持未知。
        </p>
      </header>
      {!chat.ready || !profile.ready ? (
        <p className="loading" role="status">正在读取本地画像…</p>
      ) : chat.error || profile.error ? (
        <div className="error-notice" role="alert">
          {chat.error ?? profile.error} 原资料不会自动清空，请先返回对话页检查本地数据。
        </div>
      ) : (
        <>
          <div className="profile-overview-summary" aria-label="画像状态概况">
            <span>已确认且有依据 <strong>{activeCount}</strong></span>
            <span>待审核 <strong>{pendingCount}</strong></span>
            {invalidCount > 0 && <span>来源失效 <strong>{invalidCount}</strong></span>}
            <Link href="/chat">继续对话并提取候选 ↗</Link>
          </div>
          <div className="profile-dimension-grid">
            {groups.map((group, index) => {
              const details = PROFILE_DIMENSIONS[group.dimension];
              const entries = [
                ...group.active.map((item) => ({ item, valid: true })),
                ...group.pending.map((item) => ({ item, valid: true })),
                ...group.rejected.map((item) => ({ item, valid: true })),
                ...group.invalid.map((item) => ({ item, valid: false })),
              ];
              return (
                <section className="profile-dimension" key={group.dimension} aria-labelledby={`dimension-${group.dimension}`}>
                  <div className="profile-dimension-heading">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <h2 id={`dimension-${group.dimension}`}>{details.label}</h2>
                      <p>{details.description}</p>
                    </div>
                  </div>
                  {group.active.length === 0 && <p className="profile-unknown">当前画像：未知，尚无已确认且有依据的记录。</p>}
                  {entries.map(({ item, valid }) => renderInsight(item, valid))}
                </section>
              );
            })}
          </div>
          <p className="profile-overview-note">画像和对话目前仅保存在当前浏览器。AI 推测不等于事实；确认前请核对原话。</p>
        </>
      )}
    </section>
  );
}
