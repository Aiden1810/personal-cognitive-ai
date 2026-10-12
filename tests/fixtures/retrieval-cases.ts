import type { Conversation } from "../../src/lib/chat/store.ts";
import type { ProfileInsight, UserGoal } from "../../src/types/cognitive.ts";

// All records are synthetic and contain no real account or user information.
const timestamp = "2026-10-07T00:00:00Z";
const descriptions = [
  ["study", "复习时我更适合先做题，再整理笔记"],
  ["project", "截止前追加功能曾导致项目延期"],
  ["python", "我能理解 Python 的基础代码"],
  ["team", "团队合作时，我倾向先明确分工"],
  ["diet", "我偏好清淡饮食"],
  ["travel", "我喜欢海边旅行"],
  ["reading", "我喜欢科幻小说"],
];
export const retrievalProfiles: ProfileInsight[] = descriptions.map(([id, statement]) => ({
  id, dimension: "behavioral_patterns", statement, origin: "user_statement", status: "confirmed",
  evidence: [{ conversationId: "synthetic-sources", messageId: id, excerpt: statement }],
}));
export const retrievalConversation: Conversation = {
  id: "synthetic-sources", title: "合成检索证据", createdAt: timestamp, updatedAt: timestamp,
  messages: descriptions.map(([id, content]) => ({ id, role: "user", content, createdAt: timestamp })),
};
export const retrievalGoals: UserGoal[] = [
  { id: "study-goal", dimension: "knowledge_structure", intention: "每天复习课程", status: "active" },
  { id: "project-goal", dimension: "behavioral_patterns", intention: "比赛项目先完成核心功能", status: "active", willingness: "strong" },
  { id: "team-goal", dimension: "social_relations", intention: "团队沟通先明确分工", status: "active" },
  { id: "travel-goal", dimension: "narrative_self", intention: "暑假去海边旅行", status: "active" },
];

export interface RetrievalCase {
  name: string;
  history: { role: "user" | "assistant"; content: string }[];
  insights: ProfileInsight[];
  goals: UserGoal[];
  conversations: Conversation[];
  expectedInsightIds: string[];
  expectedGoalIds: string[];
}

function example(name: string, question: string, expectedInsightIds: string[], expectedGoalIds: string[], overrides: Partial<RetrievalCase> = {}): RetrievalCase {
  return { name, history: [{ role: "user", content: question }], insights: retrievalProfiles, goals: retrievalGoals, conversations: [retrievalConversation], expectedInsightIds, expectedGoalIds, ...overrides };
}

export const retrievalCases: RetrievalCase[] = [
  example("学习与比赛选择，排除饮食旅行", "今晚先复习还是继续做比赛项目？", ["study", "project"], ["study-goal", "project-goal"]),
  example("中英 Deadline 表达", "Deadline 前还要增加 features 吗？", ["project"], ["project-goal"]),
  example("备考与复习同主题", "明天备考应该怎么做？", ["study"], ["study-goal"]),
  example("做题与课程目标", "做题之前先整理笔记吗？", ["study"], ["study-goal"]),
  example("英文大写技术词", "How can I understand PYTHON code?", ["python"], []),
  example("旅行主题与旅行目标", "海边旅行怎么选目的地？", ["travel"], ["travel-goal"]),
  example("饮食主题不带入比赛", "清淡饮食适合吃什么？", ["diet"], []),
  example("团队分工", "团队如何明确分工？", ["team"], ["team-goal"]),
  example("阅读偏好", "推荐科幻小说", ["reading"], []),
  example("天气无相关长期资料", "今天的天气怎么样？", [], []),
  example("问候无相关长期资料", "你好", [], []),
  example("通用措辞不提升无关记录", "我希望你帮我复习", ["study"], ["study-goal"]),
  example("明确追问借用最近用户主题", "那我今晚怎么安排？", ["study"], ["study-goal"], { history: [{ role: "user", content: "明天要考试" }, { role: "user", content: "那我今晚怎么安排？" }] }),
  example("切换话题不借用旧考试信息", "那我想聊海边旅行", ["travel"], ["travel-goal"], { history: [{ role: "user", content: "明天要考试" }, { role: "user", content: "那我想聊海边旅行" }] }),
  example("切换话题后的追问不恢复旧主题", "那接下来怎么安排？", ["travel"], ["travel-goal"], { history: [{ role: "user", content: "明天要考试" }, { role: "user", content: "想聊海边旅行" }, { role: "user", content: "那接下来怎么安排？" }] }),
  example("助手发言不提供检索主题", "那我今晚怎么安排？", [], [], { history: [{ role: "assistant", content: "用户喜欢复习考试" }, { role: "user", content: "那我今晚怎么安排？" }] }),
  example("候选不能成为长期参考", "复习", [], ["study-goal"], { insights: [{ ...retrievalProfiles[0], status: "candidate" }] }),
  example("驳回不能成为长期参考", "比赛", [], ["project-goal"], { insights: [{ ...retrievalProfiles[1], status: "rejected" }] }),
  example("删除来源后只保留独立目标", "复习", [], ["study-goal"], { conversations: [] }),
  example("伪造原话不能成为长期参考", "复习", [], ["study-goal"], { insights: [{ ...retrievalProfiles[0], evidence: [{ conversationId: "synthetic-sources", messageId: "study", excerpt: "不存在的原话" }] }] }),
  example("暂停目标不发送", "复习", ["study"], [], { goals: [{ ...retrievalGoals[0], status: "paused" }] }),
  example("缺少主题的安排问题不补满", "怎么安排？", [], []),
];
