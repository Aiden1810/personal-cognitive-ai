"use client";

import { PageHeading } from "@/components/page-heading";
import { useDemoData } from "@/lib/data";

const reviewLabels = {
  pending: "待确认",
  confirmed: "已确认",
  rejected: "已驳回",
};

// Yao continues this module with case forms and pattern review actions.
export function HistoryWorkspace() {
  const { state } = useDemoData();
  return (
    <>
      <PageHeading
        step="01"
        title="先记录，发生过什么。"
        description="把情境、选择与结果分开保存。观察行为模式时，也为不同的选择留一席位置。"
      />
      <div className="metrics" aria-label="记录概览">
        <div>
          <strong>{state?.cases.length ?? "—"}</strong>
          <span>历史记录</span>
        </div>
        <div>
          <strong>
            {state?.patterns.filter((item) => item.status === "confirmed")
              .length ?? "—"}
          </strong>
          <span>已确认模式</span>
        </div>
        <div>
          <strong>仅示例</strong>
          <span>目前资料来源</span>
        </div>
      </div>
      <div className="two-column">
        <section className="panel">
          <div className="section-heading">
            <h2>历史案例</h2>
            <span className="muted">合成占位资料</span>
          </div>
          {!state ? (
            <p className="empty-copy">本地资料尚不可用，请查看页面上方提示。</p>
          ) : state.cases.length === 0 ? (
            <p className="empty-copy">还没有案例。后续可在这里添加历史选择。</p>
          ) : (
            <div className="case-list">
              {state.cases.map((record, index) => (
                <article className="case-item" key={record.id}>
                  <span className="case-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <div className="case-title">
                      <h3>{record.title}</h3>
                      <span className="badge small">
                        {reviewLabels[record.status]}
                      </span>
                    </div>
                    <p>{record.context}</p>
                    <dl className="record-details">
                      <div>
                        <dt>实际选择</dt>
                        <dd>{record.actualChoice}</dd>
                      </div>
                      <div>
                        <dt>后续结果</dt>
                        <dd>{record.outcome ?? "尚未记录"}</dd>
                      </div>
                      <div>
                        <dt>来源</dt>
                        <dd>{record.sourceNote}</dd>
                      </div>
                    </dl>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        <section className="panel pattern-panel">
          <div className="section-heading">
            <h2>候选模式</h2>
            <span className="tiny-label">由你核对</span>
          </div>
          {state?.patterns.map((pattern) => (
            <article key={pattern.id}>
              <span className="badge warm">{reviewLabels[pattern.status]}</span>
              <h3>{pattern.description}</h3>
              <p>
                支持记录 {pattern.supportCaseIds.length} 条 · 反例{" "}
                {pattern.counterCaseIds.length} 条
              </p>
              <ul className="caveat-list">
                {pattern.caveats.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            </article>
          ))}
          <div className="module-note">
            下一模块：姚完善案例录入与模式确认。当前未进行行为分析。
          </div>
        </section>
      </div>
    </>
  );
}
