"use client";

import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { useDemoData } from "@/lib/data";

export function GoalsWorkspace() {
  const { state } = useDemoData();
  return (
    <>
      <PageHeading
        step="02"
        title="方向，由你来定。"
        description="确认一个模式，并不意味着必须改变它。你可以保留，也可以为以后的选择设置一条具体原则。"
      />
      <div className="two-column">
        <section className="panel">
          <div className="section-heading">
            <h2>我的改进目标</h2>
            <span className="muted">自主选择</span>
          </div>
          {state?.goals.map((goal) => (
            <article className="goal-card" key={goal.id}>
              <span
                className={`badge ${goal.status === "active" ? "" : "warm"}`}
              >
                {goal.status === "active" ? "已启用" : "未启用"}
              </span>
              <h3>{goal.description}</h3>
              <dl className="record-details">
                <div>
                  <dt>适用条件</dt>
                  <dd>{goal.applicability}</dd>
                </div>
                <div>
                  <dt>关联模式</dt>
                  <dd>{goal.patternId ? "关联已记录模式" : "未关联"}</dd>
                </div>
              </dl>
            </article>
          ))}
          {!state && <p className="empty-copy">本地资料尚不可用。</p>}
          {state?.goals.length === 0 && (
            <p className="empty-copy">
              还没有目标。目标设置功能将在下一模块完成。
            </p>
          )}
          <div className="module-note">
            下一模块：曹完善目标编辑、启用与停用。当前展示结构占位目标。
          </div>
        </section>
        <aside className="principle-note">
          <span className="eyebrow">一条好目标</span>
          <h2>
            具体到行动，
            <br />
            也允许调整。
          </h2>
          <p>
            说明希望怎样选择、在什么条件下适用。用可执行的原则表达，不给自己打一个没有测量依据的分数。
          </p>
          <Link href="/history" className="inline-link">
            回看历史依据 <span aria-hidden="true">↗</span>
          </Link>
        </aside>
      </div>
    </>
  );
}
