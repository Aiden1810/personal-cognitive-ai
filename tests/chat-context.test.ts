import assert from "node:assert/strict";
import test from "node:test";
import { selectChatContext, serializeChatContext } from "../src/lib/chat/context.ts";
import { usableProfileInsights } from "../src/lib/profile/usable.ts";
import type { ProfileInsight, UserGoal } from "../src/types/cognitive.ts";
import type { ChatMessage, Conversation } from "../src/lib/chat/store.ts";

function message(content: string, role: ChatMessage["role"] = "user"): ChatMessage {
  return { id: content, role, content, createdAt: "2026-10-07T00:00:00Z" };
}

function insight(id: string, statement: string): ProfileInsight {
  return { id, dimension: "behavioral_patterns", statement, origin: "user_statement", status: "confirmed", evidence: [{ conversationId: "c1", messageId: id, excerpt: statement }] };
}

const profiles = [insight("study", "复习时我更适合先做题"), insight("travel", "我偏好海边旅行")];
const goals: UserGoal[] = [
  { id: "study-goal", dimension: "behavioral_patterns", intention: "每天复习课程", status: "active", willingness: "strong" },
  { id: "travel-goal", dimension: "narrative_self", intention: "暑假去海边旅行", status: "active" },
  { id: "paused", dimension: "knowledge_structure", intention: "每周备考", status: "paused" },
];

test("related active goals are selected without sending unrelated or paused goals", () => {
  const selected = selectChatContext([message("如何准备期末考试？")], profiles, goals);
  assert.deepEqual(selected.insights.map((item) => item.id), ["study"]);
  assert.deepEqual(selected.goals.map((item) => item.id), ["study-goal"]);
  assert.equal(selected.goals[0].willingness, "strong");
});

test("an explicit vague follow-up uses recent user messages but not assistant inventions", () => {
  const selected = selectChatContext([message("明天要考试"), message("你喜欢海边旅行", "assistant"), message("那我今晚怎么安排？")], profiles, goals);
  assert.deepEqual(selected.insights.map((item) => item.id), ["study"]);
  assert.equal(selected.querySource, "recent_user_messages");
});

test("a new topic does not inherit the previous study topic", () => {
  const selected = selectChatContext([message("明天要考试"), message("那我想聊海边旅行")], profiles, goals);
  assert.deepEqual(selected.insights.map((item) => item.id), ["travel"]);
  assert.deepEqual(selected.goals.map((item) => item.id), ["travel-goal"]);
  assert.equal(selected.querySource, "question");
});

test("a follow-up after changing topic does not revive the older topic", () => {
  const selected = selectChatContext([message("明天要考试"), message("我想聊海边旅行"), message("那接下来怎么安排？")], profiles, goals);
  assert.deepEqual(selected.insights.map((item) => item.id), ["travel"]);
  assert.deepEqual(selected.goals.map((item) => item.id), ["travel-goal"]);
});

test("generic or unrelated questions use no remembered profiles or goals", () => {
  for (const question of ["你好", "今天的天气怎么样？", "怎么安排？"]) {
    const selected = selectChatContext([message(question)], profiles, goals);
    assert.deepEqual(selected.insights, []);
    assert.deepEqual(selected.goals, []);
  }
});

test("generic arrangement and advice wording cannot match unrelated profile or goal wording", () => {
  const records = [insight("travel", "我喜欢提前安排海边旅行"), insight("diet", "我通常听从医生建议选择清淡饮食")];
  const unrelatedGoals: UserGoal[] = [
    { id: "travel-goal", dimension: "narrative_self", intention: "安排海边旅行", status: "active" },
    { id: "diet-goal", dimension: "behavioral_patterns", intention: "听从建议选择清淡饮食", status: "active" },
  ];
  for (const question of ["怎么安排？", "请给我一些建议"]) {
    const selected = selectChatContext([message(question)], records, unrelatedGoals);
    assert.deepEqual(selected.insights, []);
    assert.deepEqual(selected.goals, []);
  }
});

test("synthetic demo labels are not relevance evidence", () => {
  const selected = selectChatContext([message("合成测试：解释一下三角形面积公式。")], profiles, [
    { id: "study-goal", dimension: "knowledge_structure", intention: "合成目标：每天先做复习题，再继续比赛项目", status: "active" },
  ]);
  assert.deepEqual(selected.insights, []);
  assert.deepEqual(selected.goals, []);
});

test("ordinary Chinese and English follow-up wording can use the previous user topic", () => {
  for (const question of ["那我具体该怎么安排？", "What next?", "Continue"]) {
    const selected = selectChatContext([message("明天要考试"), message(question)], profiles, goals);
    assert.deepEqual(selected.insights.map((item) => item.id), ["study"]);
    assert.equal(selected.querySource, "recent_user_messages");
  }
});

test("confirmed status cannot make deleted or altered source evidence eligible", () => {
  const conversation: Conversation = { id: "c1", title: "合成来源", createdAt: "2026-10-07T00:00:00Z", updatedAt: "2026-10-07T00:00:00Z", messages: [message("已经修改的原话")] };
  assert.deepEqual(selectChatContext([message("复习")], usableProfileInsights(profiles, [conversation]), goals).insights, []);
  assert.deepEqual(selectChatContext([message("复习")], usableProfileInsights(profiles, []), goals).insights, []);
});

test("long evidence and many matching records respect the actual model context budget without mutating storage", () => {
  const many = Array.from({ length: 12 }, (_, index) => ({ ...insight(`i${index}`, `复习方式${index}：${"练习".repeat(220)}`), evidence: Array.from({ length: 5 }, (_, source) => ({ conversationId: "c1", messageId: `m${index}-${source}`, excerpt: `复习记录${source}：${"做题".repeat(220)}` })) }));
  const manyGoals: UserGoal[] = Array.from({ length: 7 }, (_, index) => ({ id: `g${index}`, dimension: "behavioral_patterns", intention: `复习目标${index}：${"学习".repeat(220)}`, status: "active", willingness: "strong" }));
  const before = structuredClone({ many, manyGoals });
  const selected = selectChatContext([message("复习")], many, manyGoals);
  assert.ok(selected.insights.length > 0 && selected.insights.length <= 5);
  assert.ok(selected.goals.length > 0 && selected.goals.length <= 2);
  assert.ok(serializeChatContext(selected.insights, selected.goals).length <= 3000);
  assert.ok(selected.omittedByBudget > 0);
  assert.deepEqual({ many, manyGoals }, before);
  for (const item of selected.insights) {
    assert.ok(item.evidence.length <= 2);
    assert.ok(item.evidence.every((source) => many.find((original) => original.id === item.id)!.evidence.some((original) => original.excerpt.includes(source.excerpt))));
  }
});

test("duplicate statements consume only one context slot", () => {
  const selected = selectChatContext([message("复习怎么做题")], [profiles[0], { ...profiles[0], id: "duplicate", statement: `${profiles[0].statement}。` }], []);
  assert.equal(selected.insights.length, 1);
});

test("an unrelated aside in a long quote cannot retrieve or outrank an unrelated profile", () => {
  const walk = { ...insight("walk", "我周末偏好清晨散步"), evidence: [{ conversationId: "c1", messageId: "walk", excerpt: "我周六早上偏好清晨散步。" + "这里补充校园周边的树木和海边步道观察。".repeat(10) + "另外，我的 Python 列表切片作业需要运行几个例子。" }] };
  const python = insight("python", "遇到 Python 的列表问题，我会运行一个最小例子，再逐行观察变量。");
  const selected = selectChatContext([message("Python 的列表切片怎么一步步练？")], [python, walk], []);
  assert.deepEqual(selected.insights.map((item) => item.id), ["python"]);
});

test("selected original quotes are not cut around a question keyword", () => {
  const originalQuote = "我用最小例子理解 Python，但不依赖复杂工具。" + "具体过程是先独立观察每个变量，再回看结果。".repeat(12);
  const profile = { ...insight("python", "我会用最小例子理解 Python"), evidence: [{ conversationId: "c1", messageId: "python", excerpt: originalQuote }] };
  const selected = selectChatContext([message("Python 怎么学？")], [profile], []);
  assert.equal(selected.insights[0].evidence[0].excerpt, originalQuote);
});

test("an explicit request not to reference profiles excludes profiles without pausing independent goals", () => {
  const profile = insight("deadline", "比赛项目临近期限时，我曾因拖延没有及时排期。");
  const projectGoal: UserGoal = { id: "g1", dimension: "behavioral_patterns", intention: "比赛项目先保证核心演示", status: "active" };
  const selected = selectChatContext([message("这次比赛排期不是拖延，不要参考以前拖延的画像；只按场地开放日期安排。")], [profile], [projectGoal]);
  assert.deepEqual(selected.insights, []);
  assert.deepEqual(selected.goals.map((goal) => goal.id), ["g1"]);
  assert.equal(selected.profileExcludedByRequest, true);
});

test("subject-specific study questions exclude different-course facts and goals while retaining general learning preferences", () => {
  const theatre = insight("theatre", "我的戏剧鉴赏课程在周五上课");
  const english: UserGoal = { id: "english", dimension: "knowledge_structure", intention: "保持英语课程每周读一篇长文", status: "active" };
  const selected = selectChatContext([message("我在复习线性代数，只讲矩阵乘法的具体计算。")], [theatre, profiles[0]], [english]);
  assert.deepEqual(selected.insights.map((item) => item.id), ["study"]);
  assert.deepEqual(selected.goals, []);
});

test("scheduling questions may retain another course as a time constraint", () => {
  const theatre = insight("theatre", "我的戏剧鉴赏课程在周五上课");
  const selected = selectChatContext([message("周五复习线性代数怎么安排时间？")], [theatre], []);
  assert.deepEqual(selected.insights.map((item) => item.id), ["theatre"]);
});
