"use client";

import { useState } from "react";
import { PageHeading } from "@/components/page-heading";
import { useDemoData } from "@/lib/data";

const perspectives = [
  {
    key: "generic",
    number: "01",
    name: "普通 AI",
    subtitle: "当前问题的通用分析",
    text: "只使用当前问题、备选项与约束，不读取个人历史。",
  },
  {
    key: "original",
    number: "02",
    name: "Original Me",
    subtitle: "历史行为倾向预测",
    text: "使用历史案例和已确认模式，说明过去的选择倾向。预测不是推荐。",
  },
  {
    key: "better",
    number: "03",
    name: "Better Me",
    subtitle: "依据你目标的建议",
    text: "结合用户主动启用的目标和适用规则，提出行动建议。决定权属于你。",
  },
];

export function DecisionWorkspace() {
  const { state } = useDemoData();
  const [question, setQuestion] = useState("");
  const activeGoals =
    state?.goals.filter((goal) => goal.status === "active") ?? [];
  return (
    <>
      <PageHeading
        step="03"
        title="同一个问题，看清不同依据。"
        description="把过去可能怎样选择，与现在希望怎样行动并列。结论可以相同，依据应该清楚。"
      />
      <section className="panel question-panel">
        <div className="section-heading">
          <h2>新的决策问题</h2>
          <span className="badge warm">AI 尚未接入</span>
        </div>
        <label htmlFor="decision-question" className="input-label">
          你正在考虑什么？
        </label>
        <textarea
          id="decision-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="在这里输入问题。当前仅为输入框骨架，不会提交或生成回答。"
          rows={3}
        />
        <div className="question-bottom">
          <span>
            {activeGoals.length
              ? `已有 ${activeGoals.length} 条启用目标`
              : "还没有启用的改进目标"}
          </span>
          <button className="button" disabled>
            生成三视角 · 待接入
          </button>
        </div>
        <p className="form-note">
          输入暂不保存。后续由安接入生成接口，曹完善问题背景、证据与反馈交互。
        </p>
      </section>
      <div className="perspective-grid">
        {perspectives.map((item) => (
          <section
            className={`perspective-card ${item.key === "better" ? "highlight" : ""}`}
            key={item.key}
          >
            <span className="perspective-number">{item.number}</span>
            <h2>{item.name}</h2>
            <p className="perspective-subtitle">{item.subtitle}</p>
            <p>{item.text}</p>
            <div className="answer-placeholder">尚未生成结果</div>
            <span className="tiny-label">生成后可查看实际依据</span>
          </section>
        ))}
      </div>
      <p className="section-footnote">
        当前没有调用任何模型，也没有预置冒充实时生成的回答。实际选择与结果记录将在后续模块接入。
      </p>
    </>
  );
}
