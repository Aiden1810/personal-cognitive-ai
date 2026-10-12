import type { Conversation } from "../../src/lib/chat/store.ts";
import type { ProfileInsight, UserGoal, CognitiveDimension } from "../../src/types/cognitive.ts";

// Designed independently from the original 22 cases before reviewing the matching rules.
const specs: [string, CognitiveDimension, string, ProfileInsight["status"]?][] = [
  ["python-example", "cognitive_architecture", "遇到 Python 的列表问题，我会运行一个最小例子，再逐行观察变量。"],
  ["written-roles", "social_relations", "In team collaboration, I prefer to write roles down before discussion."],
  ["demo-scope", "behavioral_patterns", "比赛交付临近截止时，我会先删掉装饰页面，保证核心演示。"],
  ["theatre-timetable", "knowledge_structure", "我的戏剧鉴赏课程在周五上课。"],
  ["deadline-habit", "behavioral_patterns", "比赛项目临近期限时，我曾因拖延没有及时排期。"],
  ["morning-walk", "behavioral_patterns", "我周末偏好清晨散步。"],
  ["confirmed-python", "knowledge_structure", "我已完成 Python 列表切片练习。"],
  ["candidate-python", "knowledge_structure", "我正在自学 Python 列表切片。", "candidate"],
  ["rejected-python", "knowledge_structure", "我不愿意写 Python 列表切片练习。", "rejected"],
  ["deleted-source-python", "knowledge_structure", "我通过 Python 小程序练习列表切片。"],
  ["edited-source-python", "knowledge_structure", "我看 Python 列表切片时习惯画下标。"],
  ["assistant-source-python", "knowledge_structure", "我会用 Python 解释列表切片。"],
];
const longQuote = "我周六早上偏好清晨散步。" + "这里补充校园周边的树木和海边步道观察。".repeat(10) + "另外，我的 Python 列表切片作业需要运行几个例子。";
const profiles: ProfileInsight[] = specs.map(([id, dimension, statement, status]) => ({ id, dimension, statement, status: status ?? "confirmed", origin: "user_statement", evidence: [{ conversationId: id, messageId: id, excerpt: id === "morning-walk" ? longQuote : statement }] }));
const conversations: Conversation[] = profiles.map((item) => ({ id: item.id, title: "独立合成来源", createdAt: "2026-10-07T00:00:00Z", updatedAt: "2026-10-07T00:00:00Z", messages: [{ id: item.id, role: "user", content: item.evidence[0].excerpt, createdAt: "2026-10-07T00:00:00Z" }] }));
const goals: UserGoal[] = [
  { id: "python-independent", dimension: "knowledge_structure", intention: "每周用 Python 独立完成一道列表练习。", status: "active" },
  { id: "written-collaboration", dimension: "social_relations", intention: "Improve team communication by agreeing on roles in writing.", status: "active" },
  { id: "freeze-rehearse", dimension: "behavioral_patterns", intention: "比赛简报在10月15日冻结，10月24日前完成核心演示排期。", status: "active" },
  { id: "english-reading", dimension: "knowledge_structure", intention: "保持英语课程每周读一篇长文。", status: "active" },
  { id: "paused-python", dimension: "knowledge_structure", intention: "每天用 Python 练习列表切片。", status: "paused" },
];

interface ChallengeCase {
  name: string;
  history: { role: "user" | "assistant"; content: string }[];
  insights: ProfileInsight[];
  goals: UserGoal[];
  conversations: Conversation[];
  expectedInsights: string[];
  expectedGoals: string[];
}
function example(name: string, question: string, inputInsights: string[], inputGoals: string[], expectedInsights: string[], expectedGoals: string[], history?: ChallengeCase["history"]): ChallengeCase {
  return { name, history: history ?? [{ role: "user", content: question }], insights: profiles.filter((item) => inputInsights.includes(item.id)), goals: goals.filter((item) => inputGoals.includes(item.id)), conversations, expectedInsights, expectedGoals };
}
const pythonQuestion = "Python 的列表切片怎么一步步练？";
export const retrievalChallenges: ChallengeCase[] = [
  example("C01 Python 具体求助", pythonQuestion, ["python-example"], ["python-independent"], ["python-example"], ["python-independent"]),
  example("C02 英文协作", "How should our team assign roles for the hackathon?", ["written-roles"], ["written-collaboration"], ["written-roles"], ["written-collaboration"]),
  example("C03 简报冻结后的排期", "10月15日简报冻结后，怎样排期确保10月24日路演可演示？", ["demo-scope"], ["freeze-rehearse"], ["demo-scope"], ["freeze-rehearse"]),
  example("C04 追问不读取助手主题", "那接下来呢？", ["python-example", "written-roles", "demo-scope"], ["python-independent", "written-collaboration", "freeze-rehearse"], ["python-example"], ["python-independent"], [{ role: "user", content: pythonQuestion }, { role: "assistant", content: "可以顺便和团队沟通比赛计划。" }, { role: "user", content: "那接下来呢？" }]),
  example("C05 切换到 Python", "换个话题，Python 的列表切片怎么用？", ["python-example", "demo-scope"], ["python-independent", "freeze-rehearse"], ["python-example"], ["python-independent"], [{ role: "user", content: "比赛如何排期？" }, { role: "assistant", content: "继续比赛计划。" }, { role: "user", content: "换个话题，Python 的列表切片怎么用？" }]),
  example("C06 原话旁支不得召回散步", pythonQuestion, ["python-example", "morning-walk"], ["python-independent"], ["python-example"], ["python-independent"]),
  example("C07 数学不调用戏剧与英语课程", "我在复习线性代数，只讲矩阵乘法的具体计算。", ["theatre-timetable"], ["english-reading"], [], []),
  example("C08 明确不参考旧画像", "这次比赛排期不是拖延，不要参考以前拖延的画像；只按场地开放日期安排。", ["deadline-habit"], [], [], []),
  example("C09 纠正并转向公交路线", "不是，我问的是从宿舍到会场的公交路线。", ["demo-scope"], ["freeze-rehearse"], [], [], [{ role: "user", content: "比赛如何排期？" }, { role: "user", content: "不是，我问的是从宿舍到会场的公交路线。" }]),
  example("C10 审核状态", "Python 列表切片练习怎么做？", ["confirmed-python", "candidate-python", "rejected-python"], [], ["confirmed-python"], []),
  example("C11 暂停目标", "Python 列表切片练习怎么做？", ["confirmed-python"], ["python-independent", "paused-python"], ["confirmed-python"], ["python-independent"]),
  { ...example("C12 来源失效", "Python 列表切片练习怎么做？", ["confirmed-python", "deleted-source-python", "edited-source-python", "assistant-source-python"], [], ["confirmed-python"], []), conversations: conversations.filter((item) => item.id !== "deleted-source-python").map((item) => item.id === "edited-source-python" ? { ...item, messages: [{ ...item.messages[0], content: "原话已改为无关公交路线。" }] } : item.id === "assistant-source-python" ? { ...item, messages: [{ ...item.messages[0], role: "assistant" as const }] } : item) },
];
