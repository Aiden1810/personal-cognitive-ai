"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useChatData } from "@/lib/chat/client";
import { useProfileData } from "@/lib/profile/client";
import { useGoalData } from "@/lib/goals/client";
import { buildProfileOverview, PROFILE_DIMENSIONS, type ProfileDimensionGroup } from "@/lib/profile/overview";
import type { CognitiveDimension, ProfileInsight, ProfileScope } from "@/types/cognitive";
import { GoalEditor } from "./goal-editor";
import { ProfileAssessment } from "./profile-assessment";
import { ProfileReflectionPanel } from "./profile-reflection";
import { ProfileRecordInfo, ProfileScopeField } from "./profile-record-info";
import { MemoryUpdateReview } from "./memory-update-review";
import { ProfileResponseAdaptation } from "./profile-response-adaptation";
import { isTraitDimension, TRAIT_LEVEL_DETAILS } from "@/lib/profile/questionnaire";
import { evidenceDate, evidenceKey, evidenceTitle } from "@/lib/profile/evidence";
import { TraitLevelControl } from "./trait-level-control";
import { PersonalContextPanel } from "./personal-context-panel";
import { MemorySummaryPanel } from "./memory-summary";

const statusLabels: Record<ProfileInsight["status"], string> = {
  candidate: "待确认", confirmed: "已确认", rejected: "已忽略", archived: "已归档",
};

export function ProfileOverview() {
  const chat = useChatData();
  const profile = useProfileData();
  const goals = useGoalData();
  const [selectedDimension, setSelectedDimension] = useState<CognitiveDimension>("action_execution");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [draftScope, setDraftScope] = useState<ProfileScope | "">("");
  const pendingRecords = useRef<HTMLDetailsElement>(null);
  const legacyRecords = useRef<HTMLDetailsElement>(null);
  const conversations = chat.state?.conversations ?? [];
  const groups = buildProfileOverview(profile.state?.insights ?? [], conversations);
  const activeInsights = groups.flatMap((group) => group.active);
  const pendingCount = groups.reduce((sum, group) => sum + group.pending.length, 0);
  const allGoals = goals.state?.goals ?? [];
  const activeGoalCount = allGoals.filter((goal) => goal.status === "active").length;
  const traitGroups = groups.filter((group) => isTraitDimension(group.dimension));
  const legacyGroups = groups.filter((group) => !isTraitDimension(group.dimension) &&
    ([group.active, group.pending, group.rejected, group.archived, group.invalid].some((items) => items.length > 0) ||
      allGoals.some((goal) => goal.dimension === group.dimension)));
  const currentTrait = isTraitDimension(selectedDimension) ? selectedDimension : "action_execution";
  const currentLegacy = !isTraitDimension(selectedDimension) ? selectedDimension : legacyGroups[0]?.dimension;

  useEffect(() => {
    const openPendingFromHash = () => {
      if (window.location.hash === "#pending-memories" && pendingRecords.current) {
        pendingRecords.current.open = true;
        pendingRecords.current.scrollIntoView({ block: "start" });
      }
    };
    openPendingFromHash();
    window.addEventListener("hashchange", openPendingFromHash);
    return () => window.removeEventListener("hashchange", openPendingFromHash);
  }, [chat.ready, profile.ready, goals.ready]);

  function sourceSummary(item: ProfileInsight) {
    const dates = item.evidence.map((source) => evidenceDate(source, conversations))
      .filter((date): date is string => !!date && !Number.isNaN(Date.parse(date))).sort();
    const kind = item.evidence.some((source) => source.kind === "questionnaire") ? "初始问卷" : "对话原话";
    return kind + (dates.length > 0 ? " · " + new Date(dates.at(-1)!).toLocaleDateString("zh-CN") : "");
  }

  function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editingId && profile.edit(editingId, draft, draftScope || null)) {
      setEditingId(null); setDraft("");
      if (pendingRecords.current) pendingRecords.current.open = true;
      requestAnimationFrame(() => document.getElementById("profile-insight-" + editingId)?.scrollIntoView({ behavior: "smooth", block: "center" }));
    }
  }

  function remove(id: string) {
    if (window.confirm("删除这条记忆及其引用？此操作无法撤销。")) profile.deleteInsight(id);
  }

  function inspectMemory(id: string) {
    const item = activeInsights.find((insight) => insight.id === id);
    if (!item) return;
    setSelectedDimension(item.dimension);
    if (!isTraitDimension(item.dimension) && legacyRecords.current) legacyRecords.current.open = true;
    requestAnimationFrame(() => {
      const node = document.getElementById("profile-insight-" + id);
      const details = node?.querySelector<HTMLDetailsElement>(".profile-insight-details");
      if (details) details.open = true;
      node?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function renderInsight(item: ProfileInsight, valid: boolean) {
    return (
      <article className={"profile-overview-insight is-" + item.status} key={item.id} id={"profile-insight-" + item.id}>
        <div className="profile-record-heading">
          <div className="profile-insight-meta"><span>{valid ? statusLabels[item.status] : "来源不可用"}</span></div>
          <small>{sourceSummary(item)}</small>
        </div>
        {editingId === item.id ? (
          <form onSubmit={saveEdit} className="profile-edit-form">
            <label htmlFor={"overview-edit-" + item.id}>修改描述</label>
            <textarea id={"overview-edit-" + item.id} value={draft}
              onChange={(event) => setDraft(event.target.value)} maxLength={500} />
            <ProfileScopeField value={draftScope} onChange={setDraftScope} />
            <div className="profile-actions">
              <button type="submit" disabled={!draft.trim()}>保存修改</button>
              <button type="button" onClick={() => setEditingId(null)}>取消</button>
            </div>
            <p className="simple-note">保存后会进入待确认，重新确认才用于回答。</p>
          </form>
        ) : <p className="profile-insight-statement">{item.statement}</p>}
        {valid && item.status === "candidate" && editingId !== item.id && <>
          <blockquote className="profile-source-preview">原话：{item.evidence[0]?.excerpt}</blockquote>
          <div className="profile-actions">
            <button type="button" onClick={() => profile.confirm(item.id)}>记住</button>
            <button type="button" onClick={() => profile.reject(item.id)}>忽略</button>
          </div>
        </>}
        <details className="profile-insight-details">
          <summary>{item.status === "candidate" ? "核对来源与修改" : "查看来源与设置"}</summary>
          <div className="profile-insight-meta">
            <span>{item.origin === "ai_inference" ? "AI 整理" : "用户描述"}</span>
            {item.currentLevel && <span>当前自评 · {TRAIT_LEVEL_DETAILS[item.currentLevel].label}</span>}
          </div>
          <ProfileResponseAdaptation item={item} disabled={!valid || editingId === item.id || !!profile.error}
            onSave={profile.setResponseAdaptation} />
          <ProfileRecordInfo item={item} conversations={conversations} />
          <div className="profile-evidence">
            {item.evidence.map((source) => (
              <div key={evidenceKey(source)}>
                <small>{evidenceTitle(source, conversations)}</small>
                <blockquote>“{source.excerpt}”</blockquote>
              </div>
            ))}
          </div>
          {editingId !== item.id && <div className="profile-actions">
            {valid && ["archived", "rejected"].includes(item.status) && <button type="button" onClick={() => profile.confirm(item.id)}>重新启用</button>}
            {valid && <button type="button" onClick={() => { setEditingId(item.id); setDraft(item.statement); setDraftScope(item.scope ?? ""); }}>修改</button>}
            {item.status === "confirmed" && <button type="button" onClick={() => profile.archive(item.id)}>归档</button>}
            <button type="button" onClick={() => remove(item.id)}>删除</button>
          </div>}
          {editingId !== item.id && valid && <MemoryUpdateReview candidate={item} conversations={conversations} />}
        </details>
      </article>
    );
  }

  function renderDimension(group: ProfileDimensionGroup, selected: boolean) {
    const assessment = group.active.findLast((item) => item.currentLevel !== undefined);
    const latest = assessment ?? group.active.at(-1);
    return <section className="profile-focus" key={group.dimension} id={"panel-" + group.dimension}
      hidden={!selected} aria-labelledby={"dimension-" + group.dimension}>
      <header className="profile-focus-heading"><div>
        <h2 id={"dimension-" + group.dimension}>{PROFILE_DIMENSIONS[group.dimension].label}</h2>
        <p>{PROFILE_DIMENSIONS[group.dimension].description}</p>
      </div></header>
      <div className="profile-comparison">
        <div className="profile-current">
          <h3>当前自评</h3>
          {latest ? <>
            <div className="profile-current-summary">
              <strong>{isTraitDimension(group.dimension) ? TRAIT_LEVEL_DETAILS[assessment?.currentLevel ?? "unknown"].label : "已确认的自述"}</strong>
              <p>{latest.statement}</p>
            </div>
            <p className="profile-current-source">来源 · {sourceSummary(latest)}</p>
            <button type="button" className="text-button profile-summary-source" onClick={() => inspectMemory(latest.id)}>查看来源与设置</button>
          </> : <div className="profile-current-empty">
            <strong>暂不确定</strong>
            <p>还没有这方面的已确认记录。</p>
            <Link href="/onboarding">通过问卷补充自述</Link>
            <Link href="/chat">去聊聊</Link>
          </div>}
          {isTraitDimension(group.dimension) && (assessment ? <details className="profile-current-level-editor">
            <summary>调整当前自评</summary>
            <TraitLevelControl key={assessment.id} item={assessment} onSave={profile.setCurrentLevel} />
          </details> : latest && <p className="simple-note">当前档位暂不确定，可通过问卷补充。</p>)}
        </div>
        <div className="profile-target">
          <GoalEditor dimension={group.dimension} goal={allGoals.find((goal) => goal.dimension === group.dimension)} heading="我设定的目标"
            onSave={goals.upsert} onPause={goals.pause} onResume={goals.resume} onDelete={goals.deleteGoal} />
        </div>
      </div>
      <section className="profile-confirmed-records" aria-labelledby={"confirmed-title-" + group.dimension}>
        <header><h3 id={"confirmed-title-" + group.dimension}>已确认记录与来源</h3><span>{group.active.length} 条记录</span></header>
        {group.active.length > 0 ? group.active.map((item) => renderInsight(item, true)) :
          <p className="simple-note">核对并记住候选后，记录会在这里展示。</p>}
      </section>
      {group.rejected.length > 0 && <details className="profile-record-group">
        <summary>已忽略的记录 <span>{group.rejected.length} 条</span></summary>
        {group.rejected.map((item) => renderInsight(item, true))}
      </details>}
      {group.archived.length > 0 && <details className="profile-record-group">
        <summary>已归档的记忆 <span>{group.archived.length} 条</span></summary>
        {group.archived.map((item) => renderInsight(item, true))}
      </details>}
      {group.invalid.length > 0 && <details className="profile-record-group">
        <summary>来源不可用 <span>{group.invalid.length} 条</span></summary>
        {group.invalid.map((item) => renderInsight(item, false))}
      </details>}
    </section>;
  }

  return (
    <section className="profile-overview profile-desktop" aria-labelledby="profile-title">
      <header className="page-heading"><div><h1 id="profile-title">我的画像</h1><p className="simple-note">从五项具体做事方式，了解当前状态与希望改变的方向。</p></div><Link className="questionnaire-entry" href="/onboarding">{profile.state?.onboarding?.status === "completed" ? "重新填写问卷" : "填写初始问卷"}</Link></header>
      {!chat.ready || !profile.ready || !goals.ready ? <p className="loading" role="status">正在加载…</p> :
        chat.error || profile.error || goals.error ? <div className="error-notice" role="alert">
          {chat.error ?? profile.error ?? goals.error}
          {goals.error && <button type="button" className="text-button" onClick={() => {
            if (window.confirm("清空当前浏览器里的全部目标？此操作无法撤销。")) goals.resetGoals();
          }}>清空损坏的目标资料</button>}
        </div> : <>
          <div className="profile-navigation-row">
            <nav className="profile-dimension-nav" aria-label="选择画像维度">
              {traitGroups.map((group) => (
                <button type="button" key={group.dimension}
                  className={"profile-dimension-link " + (currentTrait === group.dimension ? "is-current" : "")}
                  aria-pressed={currentTrait === group.dimension} aria-controls={"panel-" + group.dimension}
                  onClick={() => setSelectedDimension(group.dimension)}>
                  <span className="profile-dimension-label">
                    <strong>{PROFILE_DIMENSIONS[group.dimension].label}</strong>
                  </span>
                </button>
              ))}
            </nav>
            <a className="profile-pending-entry" href="#pending-memories" onClick={() => { if (pendingRecords.current) pendingRecords.current.open = true; }}>审核候选记忆（{pendingCount}）</a>
          </div>
          <div className="profile-dimension-panels">{traitGroups.map((group) => renderDimension(group, currentTrait === group.dimension))}</div>
          <details className="profile-record-group profile-pending-group" id="pending-memories" ref={pendingRecords}>
            <summary>候选记忆 · 等待你审核 <span>{pendingCount} 条</span></summary>
            <p className="simple-note">以下内容是待核对的候选；记住后才进入当前画像。</p>
            {pendingCount > 0 ? groups.filter((group) => group.pending.length > 0).map((group) => <section className="profile-pending-dimension" key={group.dimension} aria-labelledby={"pending-title-" + group.dimension}>
              <h3 id={"pending-title-" + group.dimension}>{PROFILE_DIMENSIONS[group.dimension].label}</h3>
              {group.pending.map((item) => renderInsight(item, true))}
            </section>) : <p className="simple-note">暂无待审核候选，可在聊天中主动整理新记忆。</p>}
          </details>
          <div className="profile-tools">
            <PersonalContextPanel />
            <details className="profile-tool legacy-profile-records" ref={legacyRecords}>
              <summary><strong>其他背景与旧资料</strong><span>{legacyGroups.length} 个分类</span></summary>
              <p className="simple-note">原有记录与目标保留，不自动换成五项行为档位。</p>
              {legacyGroups.length > 0 ? <>
                <nav className="legacy-profile-dimensions" aria-label="其他背景分类">{legacyGroups.map((group) => <button type="button" key={group.dimension}
                  className={"profile-dimension-link " + (currentLegacy === group.dimension ? "is-current" : "")}
                  aria-pressed={currentLegacy === group.dimension} aria-controls={"panel-" + group.dimension}
                  onClick={() => setSelectedDimension(group.dimension)}><span className="profile-dimension-label"><strong>{PROFILE_DIMENSIONS[group.dimension].label}</strong><small>{group.active.length} 条已确认</small></span></button>)}</nav>
                {legacyGroups.map((group) => renderDimension(group, currentLegacy === group.dimension))}
              </> : <p className="simple-note">暂无旧分类记录。</p>}
            </details>
            <details className="profile-tool" id="memory-summary">
              <summary><strong>记忆摘要</strong><span className="profile-tool-symbol" aria-hidden="true">＋</span></summary>
              <MemorySummaryPanel insights={activeInsights} conversations={conversations} onInspect={inspectMemory} />
            </details>
            <details className="profile-tool">
              <summary><strong>综合观察</strong><span className="profile-tool-symbol" aria-hidden="true">＋</span></summary>
              <ProfileReflectionPanel insights={activeInsights} />
            </details>
            <details className="profile-tool">
              <summary><strong>我的整理与核对</strong><span className="profile-tool-symbol" aria-hidden="true">＋</span></summary>
              <ProfileAssessment insights={activeInsights} />
            </details>
          </div>
          <p className="profile-overview-footnote">{activeInsights.length} 条有效确认记录 · {activeGoalCount} 个启用目标。当前自评、目标档位、改变意愿与 AI 帮助方式分别保存。</p>
        </>}
    </section>
  );
}
