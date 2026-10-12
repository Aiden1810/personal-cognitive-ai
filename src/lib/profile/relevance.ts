// Finite topic rules complement literal matches; these are not embeddings.
const TOPICS = [
  { label: "学习与课程", words: ["复习", "学习", "备考", "考试", "做题", "课程", "学业", "课业", "作业", "背诵", "study", "studying", "learn", "learning", "review", "revision", "exam", "exams", "homework", "coursework"] },
  { label: "项目与交付", words: ["比赛", "路演", "项目", "功能", "开发", "演示", "交付", "参赛", "竞赛", "截止", "期限", "延期", "project", "competition", "contest", "demo", "feature", "features", "deadline"] },
  { label: "时间安排", words: ["时间管理", "时间分配", "排期", "拖延", "schedule", "scheduling", "procrastination"] },
  { label: "睡眠与作息", words: ["早起", "早睡", "晚睡", "熬夜", "睡眠", "作息", "起床", "sleep", "sleeping", "bedtime", "insomnia"] },
  { label: "合作与沟通", words: ["合作", "团队", "沟通", "分工", "队友", "协作", "team", "teamwork", "communication", "collaboration"] },
] as const;

const ENGLISH_STOP_WORDS = new Set(["i", "me", "my", "we", "you", "your", "a", "an", "the", "and", "or", "to", "of", "in", "on", "at", "is", "are", "am", "be", "do", "does", "can", "could", "should", "would", "how", "what", "when", "why", "it", "this", "that", "want", "like", "first", "please", "help", "next", "continue", "some", "advice", "arrange", "tonight", "today", "now"]);

// Only explicit, known course names can conflict; a general learning preference stays eligible.
const STUDY_SUBJECTS = [
  /数学|线性代数|矩阵|微积分|\b(?:math|mathematics|algebra|calculus)\b/u,
  /英语|英文阅读|\benglish\b/u,
  /语文|古文|文言文/u,
  /戏剧|\b(?:theatre|theater|drama)\b/u,
  /数据库|联合索引|\b(?:database|databases|sql)\b/u,
  /操作系统|页表|\boperating systems?\b/u,
];

export function hasDifferentStudySubject(value: string, question: string): boolean {
  if (/安排|排期|日程|时间分配|时间管理|\b(?:schedule|timetable|deadline)\b/iu.test(question)) return false;
  const recordSubjects = STUDY_SUBJECTS.filter((subject) => subject.test(normalized(value)));
  const querySubjects = STUDY_SUBJECTS.filter((subject) => subject.test(normalized(question)));
  return recordSubjects.length > 0 && querySubjects.length > 0 && !recordSubjects.some((subject) => querySubjects.includes(subject));
}

function normalized(value: string): string {
  // Demo labels describe the source of text, not a topic to personalize on.
  return value.normalize("NFKC").toLowerCase().replace(/(?:合成|虚构)(?:测试|目标|案例|演示|资料)[：:，,。\s]/gu, " ");
}

export function searchTerms(value: string): Set<string> {
  const meaningful = normalized(value).replace(/能不能|是不是|告诉|请问|应该|可以|怎么|如何|是否|什么|希望|想要|喜欢|倾向|最近|自己|一下|一点|继续|谢谢|觉得|需要|目前|总是|经常|有时|适合|安排|建议|步骤|开始|具体|请给|一些|用户|今天|今晚|现在|然后|接下来|刚才|上面|这个|那个|这些|那么|所以|我|你|的|了|是|有|先|还|再|这|那|很|更|想|帮|该/gu, " ");
  const terms = new Set<string>();
  for (const part of meaningful.match(/[\p{Script=Han}]+|[a-z][a-z0-9]*/gu) ?? []) {
    if (/\p{Script=Han}/u.test(part)) {
      for (let index = 0; index < part.length - 1; index++) terms.add(part.slice(index, index + 2));
    } else if (part.length > 1 && !ENGLISH_STOP_WORDS.has(part)) {
      terms.add(part);
    }
  }
  return terms;
}

function topicLabels(value: string): string[] {
  const text = normalized(value);
  const english = new Set(text.match(/[a-z][a-z0-9]*/gu) ?? []);
  return TOPICS.filter((topic) => topic.words.some((word) =>
    /[a-z]/u.test(word) ? english.has(word) : text.includes(word)
  )).map((topic) => topic.label);
}

export interface RelevanceMatch {
  score: number;
  terms: string[];
  topics: string[];
}

export function matchProfileText(value: string, question: string): RelevanceMatch {
  if (hasDifferentStudySubject(value, question)) return { score: 0, terms: [], topics: [] };
  const terms = searchTerms(value);
  const topics = topicLabels(value);
  const matchedTerms = [...searchTerms(question)].filter((term) => terms.has(term));
  const matchedTopics = topicLabels(question).filter((topic) => topics.includes(topic));
  return { score: matchedTerms.length * 2 + matchedTopics.length * 3, terms: matchedTerms, topics: matchedTopics };
}
