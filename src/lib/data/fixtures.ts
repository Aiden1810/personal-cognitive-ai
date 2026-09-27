import { CONTRACT_VERSION, DEMO_USER_ID } from "../../types/domain.ts";
import type { DemoState } from "../../types/domain.ts";

const timestamp = "2026-09-27T00:00:00.000Z";
const record = {
  userId: DEMO_USER_ID,
  createdAt: timestamp,
  updatedAt: timestamp,
};

export function createDemoState(): DemoState {
  return {
    contractVersion: CONTRACT_VERSION,
    cases: [
      {
        ...record,
        id: "sample-case-1",
        title: "占位记录 · 一次选择",
        context:
          "用于连接页面与公共类型的合成记录。具体演示场景由团队稍后确定。",
        scenario: "demo-placeholder",
        options: ["示例选项一", "示例选项二"],
        constraints: ["约束条件尚未确定"],
        actualChoice: "示例选项一",
        outcome: null,
        occurredAt: null,
        sourceType: "demo",
        sourceNote: "合成占位数据，不是真实用户行为。",
        sourceRef: null,
        status: "confirmed",
      },
      {
        ...record,
        id: "sample-case-2",
        title: "占位记录 · 不同选择",
        context: "展示反例字段的数据结构，不用于证明任何真实行为模式。",
        scenario: "demo-placeholder",
        options: ["示例选项一", "示例选项二"],
        constraints: [],
        actualChoice: "示例选项二",
        outcome: null,
        occurredAt: null,
        sourceType: "demo",
        sourceNote: "合成占位数据，不是真实用户行为。",
        sourceRef: null,
        status: "confirmed",
      },
    ],
    patterns: [
      {
        ...record,
        id: "sample-pattern-1",
        description: "候选模式占位：尚未进行 AI 分析。",
        scenario: "demo-placeholder",
        supportCaseIds: ["sample-case-1"],
        counterCaseIds: ["sample-case-2"],
        caveats: ["只展示数据结构；不能推导任何人的行为特征。"],
        status: "pending",
        userNote: null,
      },
    ],
    goals: [
      {
        ...record,
        id: "sample-goal-1",
        patternId: null,
        description: "目标占位：等待用户设置具体希望改变的行为。",
        scenario: "demo-placeholder",
        applicability: "演示场景确定后填写适用条件。",
        status: "inactive",
      },
    ],
    comparisons: [],
    feedback: [],
  };
}
