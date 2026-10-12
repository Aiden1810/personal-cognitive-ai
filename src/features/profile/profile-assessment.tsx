"use client";

import { useState, type FormEvent } from "react";
import { useAssessmentData } from "@/lib/profile/assessment-client";
import { selectCurrentAssessment, type AssessmentLabel } from "@/lib/profile/assessment";
import { PROFILE_DIMENSIONS } from "@/lib/profile/overview";
import type { ProfileInsight } from "@/types/cognitive";

export function ProfileAssessment({ insights }: { insights: ProfileInsight[] }) {
  const assessment = useAssessmentData();
  const [firstId, setFirstId] = useState("");
  const [secondId, setSecondId] = useState("");
  const [note, setNote] = useState("");
  const validIds = new Set(insights.map((item) => item.id));
  const current = assessment.state ? selectCurrentAssessment(assessment.state, validIds) : { labels: {}, tensions: [] };
  const strength = insights.filter((item) => current.labels[item.id] === "strength");
  const growth = insights.filter((item) => current.labels[item.id] === "growth");
  const first = insights.find((item) => item.id === firstId) ?? insights[0];
  const second = insights.find((item) => item.id === secondId) ?? insights[1];

  function addTension(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!first || !second) return;
    if (assessment.addTension(first.id, second.id, note)) setNote("");
  }

  function renderTagged(items: ProfileInsight[], label: AssessmentLabel) {
    return items.length === 0 ? <p className="assessment-empty">还没有标记。可以从下方已确认的画像中选择。</p> :
      items.map((item) => (
        <article className="assessment-point" key={item.id}>
          <span>{PROFILE_DIMENSIONS[item.dimension].label}</span>
          <p>{item.statement}</p>
          <small>依据：“{item.evidence[0]?.excerpt}”</small>
          <button type="button" className="text-button" onClick={() => assessment.setLabel(item.id, null)}>取消{label === "strength" ? "优势" : "待改善"}标记</button>
        </article>
      ));
  }

  return (
    <section className="profile-assessment" aria-labelledby="assessment-title">
      <div className="assessment-heading">
        <div>
          <h2 id="assessment-title">我的整理</h2>
          <p>标记优势、想改善的地方，或把两条记忆放在一起核对。</p>
        </div>
      </div>
      {!assessment.ready ? <p role="status">正在读取本地标记…</p> : assessment.error ? (
        <div className="error-notice" role="alert">{assessment.error} 原记录不会自动清空。
          <button type="button" className="text-button" onClick={() => {
            if (window.confirm("清空全部画像标记与核对记录？此操作无法撤销。")) assessment.resetAssessment();
          }}>明确清空标记</button>
        </div>
      ) : (
        <>
          <div className="assessment-columns">
            <div className="assessment-column">
              <h3><span aria-hidden="true">↗</span> 我想发挥的优势</h3>
              {renderTagged(strength, "strength")}
            </div>
            <div className="assessment-column">
              <h3><span aria-hidden="true">◎</span> 我想改善的地方</h3>
              {renderTagged(growth, "growth")}
            </div>
          </div>
          {insights.length > 0 ? (
            <details className="assessment-manage">
              <summary>标记已确认的画像</summary>
              <div className="assessment-manage-list">
                {insights.map((item) => (
                  <div key={item.id} className="assessment-manage-row">
                    <p><strong>{PROFILE_DIMENSIONS[item.dimension].label}</strong> {item.statement}</p>
                    <div>
                      <button type="button" className={current.labels[item.id] === "strength" ? "is-active" : ""} onClick={() => assessment.setLabel(item.id, current.labels[item.id] === "strength" ? null : "strength")}>优势</button>
                      <button type="button" className={current.labels[item.id] === "growth" ? "is-active" : ""} onClick={() => assessment.setLabel(item.id, current.labels[item.id] === "growth" ? null : "growth")}>待改善</button>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          ) : <p className="assessment-empty">记住一条记忆后，就能在这里整理。</p>}
          <div className="assessment-tensions">
            <div>
              <h3>可能需要核对的地方</h3>
              <p>两条描述可能属于不同时间或情境。先把依据并排看，再决定是否真的矛盾。</p>
            </div>
            {current.tensions.map((item) => {
              const left = insights.find((insight) => insight.id === item.insightIds[0]);
              const right = insights.find((insight) => insight.id === item.insightIds[1]);
              if (!left || !right) return null;
              return <article className="assessment-tension" key={item.id}>
                <p>{item.note}</p>
                <div><blockquote>{left.statement}<small>“{left.evidence[0]?.excerpt}”</small></blockquote><blockquote>{right.statement}<small>“{right.evidence[0]?.excerpt}”</small></blockquote></div>
                <button type="button" className="text-button" onClick={() => assessment.removeTension(item.id)}>移出核对列表</button>
              </article>;
            })}
            {insights.length >= 2 && <form className="assessment-tension-form" onSubmit={addTension}>
              <label htmlFor="tension-first">第一条画像</label>
              <select id="tension-first" value={first?.id ?? ""} onChange={(event) => setFirstId(event.target.value)}>
                {insights.map((item) => <option key={item.id} value={item.id}>{item.statement}</option>)}
              </select>
              <label htmlFor="tension-second">第二条画像</label>
              <select id="tension-second" value={second?.id ?? ""} onChange={(event) => setSecondId(event.target.value)}>
                {insights.map((item) => <option key={item.id} value={item.id}>{item.statement}</option>)}
              </select>
              <label htmlFor="tension-note">你想核对什么？</label>
              <textarea id="tension-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} placeholder="例如：我在独立任务里是这样，在团队合作时却不同" required />
              <button type="submit" disabled={!note.trim() || first?.id === second?.id}>加入核对列表</button>
            </form>}
          </div>
        </>
      )}
    </section>
  );
}
