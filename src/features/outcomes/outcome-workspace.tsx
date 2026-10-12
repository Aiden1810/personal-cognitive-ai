"use client";

import Link from "next/link";
import { useState } from "react";
import { useGoalData } from "@/lib/goals/client";
import { useOutcomeData } from "@/lib/outcomes/client";
import { compareRecentOutcomes, summarizeOutcomes } from "@/lib/outcomes/store";
import { PROFILE_DIMENSIONS } from "@/lib/profile/overview";

import { OutcomeEditor, OUTCOME_RATING_LABELS as ratingLabels } from "./outcome-editor";

export function OutcomeWorkspace() {
  const goals = useGoalData();
  const outcomes = useOutcomeData();
  const [selectedGoalId, setSelectedGoalId] = useState("");
  const allGoals = goals.state?.goals ?? [];
  const entries = outcomes.state?.entries ?? [];
  const summary = summarizeOutcomes(entries);
  const selectedGoal = allGoals.find((goal) => goal.id === selectedGoalId) ?? allGoals[0];
  const comparison = selectedGoal ? compareRecentOutcomes(entries, selectedGoal.id) : null;

  function remove(id: string) {
    if (window.confirm("删除这条记录？此操作无法撤销。")) outcomes.deleteEntry(id);
  }

  return (
    <section className="outcome-workspace" aria-labelledby="outcome-title">
      <header className="page-heading"><h1 id="outcome-title">行动记录</h1></header>
      {!goals.ready || !outcomes.ready ? <p className="loading" role="status">正在加载…</p> : <>
        {(goals.error || outcomes.error) && <div className="error-notice" role="alert">
          {goals.error && <p>{goals.error} <button type="button" className="text-button" onClick={goals.retryLoad}>重新读取目标资料</button></p>}
          {outcomes.error && <p>{outcomes.error} <button type="button" className="text-button" onClick={outcomes.retryLoad}>重新读取行动记录</button></p>}
          {outcomes.errorCode === "INVALID_STORED_DATA" && <button type="button" className="text-button" onClick={() => {
            if (window.confirm("清空所有行动记录？此操作无法撤销。")) outcomes.resetOutcomes();
          }}>清空损坏的记录资料</button>}
        </div>}
        {goals.state && outcomes.state && <>
          <div className="outcome-summary" aria-label="用户自评记录概况">
            <div><strong>{entries.length}</strong><span>次记录</span></div>
            <div><strong>{summary.toward}</strong><span>次自评有进展</span></div>
            <div><strong>{summary.unclear}</strong><span>次还不确定</span></div>
            <div><strong>{summary.away}</strong><span>次偏离目标</span></div>
          </div>
          <div className="outcome-layout">
            <section className="outcome-panel" aria-labelledby="outcome-form-title">
              <h2 id="outcome-form-title">记录一次行动</h2>
              {allGoals.length === 0 ? <div className="outcome-empty">
                <p>先写下一个目标，再记录你的行动。</p>
                <Link href="/profile">去设置目标 ↗</Link>
              </div> : <div className="outcome-form">
                <div className="outcome-step">
                  <label htmlFor="outcome-goal">对应目标</label>
                  <select id="outcome-goal" value={selectedGoal?.id ?? ""} onChange={(event) => setSelectedGoalId(event.target.value)}>
                    {allGoals.map((goal) => <option key={goal.id} value={goal.id}>{goal.intention}</option>)}
                  </select>
                  <details className="outcome-trend">
                    <summary>回顾近期变化</summary>
                    {comparison ? <p>
                      最近 3 次：{comparison.recentToward} 次有进展、{comparison.recentAway} 次偏离目标；
                      前 3 次：{comparison.previousToward} 次有进展、{comparison.previousAway} 次偏离目标。这是自评回顾。
                    </p> : <p>同一目标记录满 6 次后，可比较前后变化。</p>}
                  </details>
                </div>
                {goals.error && <p className="simple-note">目标资料尚未重新读取，草稿保留；重新读取成功后才能保存行动。</p>}
                <OutcomeEditor goal={selectedGoal} disabled={!!goals.error} onSave={outcomes.add} />
              </div>}
            </section>
            <section className="outcome-panel outcome-history" aria-labelledby="outcome-history-title">
              <div className="outcome-history-heading"><h2 id="outcome-history-title">历史记录</h2>{entries.length > 0 && <span>{entries.length} 条</span>}</div>
              {entries.length === 0 ? <div className="outcome-empty"><p>还没有记录。</p></div> :
                <div className="outcome-entries">
                  {entries.map((entry) => <article className="outcome-entry" key={entry.id}>
                    <div className="outcome-entry-top">
                      <time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleDateString("zh-CN")}</time>
                      <span className={"outcome-rating-label is-" + entry.rating}>{ratingLabels[entry.rating]}</span>
                    </div>
                    <h3>{entry.action}</h3>
                    <p>{entry.result}</p>
                    <details className="outcome-entry-context"><summary>当时的目标</summary><p>{entry.goalIntention}</p></details>
                    <div className="outcome-entry-footer">
                      <span>{PROFILE_DIMENSIONS[entry.dimension].label}</span>
                      <button type="button" className="text-button" onClick={() => remove(entry.id)}>删除</button>
                    </div>
                  </article>)}
                </div>}
            </section>
          </div>
        </>}
      </>}
    </section>
  );
}
