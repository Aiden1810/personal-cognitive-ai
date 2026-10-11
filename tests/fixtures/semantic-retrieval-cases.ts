import type { ChatMessage, Conversation } from "../../src/lib/chat/store.ts";
import type { CognitiveDimension, ProfileInsight, ProfileScope } from "../../src/types/cognitive.ts";

// Small, manually labelled synthetic examples; not a blind test or real-user accuracy estimate.
// No embeddings or scores are supplied: the evaluator must use the actual retrieval implementation.
export interface SemanticRetrievalCase {
  id: string;
  label: string;
  history: Pick<ChatMessage, "role" | "content">[];
  insights: ProfileInsight[];
  conversations: Conversation[];
  expectedIds: string[];
  forbiddenIds: string[];
  // Omitted means expectedIds. Additional retrieved items must also be checked.
  allowedIds?: string[];
  note: string;
}

function createInsight(
  id: string,
  dimension: CognitiveDimension,
  statement: string,
  scope: ProfileScope,
  status: ProfileInsight["status"] = "confirmed",
): ProfileInsight {
  return {
    id, dimension, statement, scope, status,
    origin: status === "candidate" ? "ai_inference" : "user_statement",
    evidence: [{ conversationId: `source-${id}`, messageId: `message-${id}`, excerpt: statement }],
  };
}

export const semanticRetrievalProfiles: ProfileInsight[] = [
  createInsight("speech-pressure", "cognitive_architecture",
    "我面对观众发言时容易紧张，脑中准备好的内容会突然消失。", "current_state"),
  createInsight("late-report", "behavioral_patterns",
    "我总到交卷前一晚才动笔，往往熬夜赶完报告。", "pattern"),
  createInsight("note-summary", "cognitive_architecture",
    "接触新材料时，我会写下几条笔记，再用自己的话重述。", "preference"),
  createInsight("ask-peer", "social_relations",
    "卡在代码错误上时，我通常埋头独自查很久，迟迟没有向同伴求助。", "pattern"),
  createInsight("usable-first", "values_and_beliefs",
    "我最看重的是交出去的东西确实能用，花哨外观可以放到后面。", "preference"),
  createInsight("small-iterations", "behavioral_patterns",
    "我把大任务拆成小块，每完成一块就检查能否运行。", "pattern"),
  createInsight("db-column-order", "knowledge_structure",
    "我在数据库课上容易混淆联合索引中列的先后顺序。", "current_state"),
  createInsight("os-pages", "knowledge_structure",
    "我在操作系统课程中经常把页表和缓存弄混。", "current_state"),
  createInsight("code-practice-gap", "knowledge_structure",
    "我理解概念不慢，但把它们变成可执行代码时缺少练手经验。", "current_state"),
  createInsight("candidate-help", "social_relations",
    "我遇到代码错误时会向同伴求助。", "pattern", "candidate"),
  createInsight("rejected-help", "social_relations",
    "我面对代码错误时不愿向同伴求助。", "pattern", "rejected"),
  createInsight("archived-help", "social_relations",
    "我卡在代码错误上时，不愿向同伴求助。", "pattern", "archived"),
  {
    ...createInsight("empty-evidence-summary", "cognitive_architecture",
      "我习惯先提炼摘要，再把笔记整理成结构图。", "preference"),
    evidence: [],
  },
];

const sourceTime = "2026-10-09T00:00:00.000Z";
const sourceConversations: Conversation[] = semanticRetrievalProfiles.flatMap((insight) =>
  insight.evidence.flatMap((source) => source.kind === "questionnaire" ? [] : [{
    id: source.conversationId,
    title: "语义检索合成来源",
    createdAt: sourceTime,
    updatedAt: sourceTime,
    messages: [{ id: source.messageId, role: "user" as const, content: source.excerpt, createdAt: sourceTime }],
  }])
);

function example(
  id: string,
  label: string,
  question: string,
  inputIds: string[],
  expectedIds: string[],
  note: string,
  history?: SemanticRetrievalCase["history"],
): SemanticRetrievalCase {
  const insights = inputIds.map((inputId) => {
    const insight = semanticRetrievalProfiles.find((item) => item.id === inputId);
    if (!insight) throw new Error(`Unknown semantic fixture insight: ${inputId}`);
    return insight;
  });
  const sourceIds = new Set(insights.flatMap((insight) => insight.evidence.flatMap((source) => source.kind === "questionnaire" ? [] : [source.conversationId])));
  return {
    id, label,
    history: history ?? [{ role: "user", content: question }],
    insights,
    conversations: sourceConversations.filter((conversation) => sourceIds.has(conversation.id)),
    expectedIds,
    forbiddenIds: inputIds.filter((inputId) => !expectedIds.includes(inputId)),
    note,
  };
}

const confirmedProfileIds = semanticRetrievalProfiles
  .filter((insight) => insight.status === "confirmed" && insight.evidence.length > 0)
  .map((insight) => insight.id);

export const semanticRetrievalCases: SemanticRetrievalCase[] = [
  example("S01", "发言紧张与答辩压力的改写",
    "答辩前焦虑，担心现场脑袋空白，该怎样缓解压力？",
    ["speech-pressure", "late-report", "note-summary"], ["speech-pressure"],
    "普通发言状态的同义表达，不推断心理诊断；焦虑和压力应关联已有的发言紧张原话。"),
  example("S02", "拖到最后与临近截止的改写",
    "距离提交只剩一天又没开工，如何避免到临近截止才匆忙完成？",
    ["late-report", "speech-pressure", "db-column-order"], ["late-report"],
    "提交前迟迟不动手，与交卷前一晚赶报告描述同一种行为。"),
  example("S03", "笔记与摘要的改写",
    "面对大量概念，如何提炼成简短摘要，便于回忆要点？",
    ["note-summary", "late-report", "os-pages"], ["note-summary"],
    "摘要与用自己的话写笔记有关；具体课程知识和赶报告经历不能因此被召回。"),
  example("S04", "独自查错与请人帮忙的改写",
    "程序调不通一直硬扛，怎么开口请别人搭把手？",
    ["ask-peer", "speech-pressure", "note-summary"], ["ask-peer"],
    "求助方式应关联同伴求助习惯，不把一般发言紧张当成同一个社交情境。"),
  example("S05", "取舍偏好与行动方式跨维关联",
    "团队要做个可用原型，请按我的取舍习惯和推进节奏给出做法。",
    ["usable-first", "small-iterations", "db-column-order", "speech-pressure"],
    ["usable-first", "small-iterations"],
    "同时需要价值取舍与小块推进方式；两条来自不同维度的资料都有具体用途。"),
  example("S06", "数据库与操作系统课程错配",
    "数据库课程的联合索引怎样选择列顺序？",
    ["db-column-order", "os-pages"], ["db-column-order"],
    "两者都是计算机课程，但索引列顺序与操作系统页表不是同一问题。"),
  example("S07", "饮食问题不附加学习画像",
    "电饭煲蒸米饭时，水应该放多少？",
    confirmedProfileIds, [],
    "这些资料没有饮食依据；允许空结果，不能因为存在个人资料就补满。"),
  example("S08", "旅游交通问题不附加学习画像",
    "周日从氹仔出发去大三巴，坐哪一路公交？",
    confirmedProfileIds, [],
    "交通路线询问没有个人画像需求，现有资料也不包含出行限制。"),
  example("S09", "本次状态的明确否定",
    "这回发言我一点也不紧张，手稿也很完整；只帮我把开场白改得自然些。",
    ["speech-pressure", "note-summary"], [],
    "用户否定本次紧张状态且只请求文字润色；不能用旧状态反向个性化，历史资料本身仍保留。"),
  example("S10", "明确不需要画像",
    "这道题只按题目条件推导，不需要画像。请解释数据库联合索引的前缀原则。",
    ["db-column-order", "os-pages", "note-summary"], [],
    "即使索引画像语义相关，用户本次明确排除画像，应得到空资料选择。"),
  example("S11", "候选驳回与归档不参与召回",
    "我卡在代码错误上时迟迟没有求助，可以怎样向同伴说明卡点？",
    ["ask-peer", "candidate-help", "rejected-help", "archived-help"], ["ask-peer"],
    "未确认用 candidate 表示；candidate、rejected、archived 不因文字相似而成为可用事实。"),
  example("S12", "没有证据的确认项仍不可用",
    "我做笔记时需要提炼摘要，有什么方法？",
    ["empty-evidence-summary"], [],
    "故意构造空 evidence 验证入口过滤；它不是允许保存的正常画像。"),
  example("S13", "短接续只继承用户主题",
    "那接下来呢？",
    ["late-report", "db-column-order", "ask-peer"], ["late-report"],
    "追问继承最近实质用户话题，助手提到的数据库不能变成检索主题。",
    [
      { role: "user", content: "最近交卷前一晚才动笔，常常熬夜赶完报告，有办法提前开工吗？" },
      { role: "assistant", content: "也可以把数据库课的索引画个图。" },
      { role: "user", content: "那接下来呢？" },
    ]),
  example("S14", "转向文章摘要后停止继承旧主题",
    "换个话题，怎样把一篇长文章压缩成几句核心意思？",
    ["late-report", "note-summary", "ask-peer"], ["note-summary"],
    "新话题应关联概括材料的方法，不继续召回前面的赶报告行为。",
    [
      { role: "user", content: "交卷前一晚又开始赶报告，怎么办？" },
      { role: "assistant", content: "可以先列出任务。" },
      { role: "user", content: "换个话题，怎样把一篇长文章压缩成几句核心意思？" },
    ]),
  example("S15", "理解原理与动手编码的差距",
    "原理看懂了，可一动手就卡住，怎样练到能够独立写出小程序？",
    ["code-practice-gap", "note-summary", "db-column-order"], ["code-practice-gap"],
    "从概念走向可执行代码的经验不足，与看懂却写不出的求助相符；不是摘要或索引问题。"),
];
