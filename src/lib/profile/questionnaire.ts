import { TRAIT_DIMENSIONS, type TraitDimension, type TraitLevel, type QuestionnaireAnswer, type ProfileInsight } from "../../types/cognitive.ts";

export const TRAIT_DETAILS: Record<TraitDimension, { label: string; description: string }> = {
  action_execution: { label: "行动力", description: "开始行动、形成初版，并在中断后继续推进。" },
  planning: { label: "规划与拆解", description: "拆清步骤、理顺先后，明确做到什么程度算完成。" },
  time_management: { label: "时间安排", description: "估计用时、预留余量，并根据实际进度调整安排。" },
  reflection: { label: "复盘调整", description: "回看具体做法，把经验转化为下一次可检查的调整。" },
  exploration: { label: "探索尝试", description: "在成本可承受时试用新方法，由你决定是否继续。" },
};
export const TRAIT_LEVEL_DETAILS: Record<TraitLevel, { label: string; description: string }> = {
  low: { label: "低 · 较少出现", description: "相关行为近期在少数情况下出现。" },
  medium: { label: "中 · 有时出现", description: "相关行为近期在部分情况下出现。" },
  high: { label: "高 · 较常出现", description: "相关行为近期在多数情况下出现。" },
  varied: { label: "随情境变化", description: "不同情境下表现不同，保留具体描述。" },
  unknown: { label: "暂不确定", description: "当前资料不足，或你尚不确定自己的状态。" },
};
export const ANSWER_DETAILS: Record<QuestionnaireAnswer, { label: string; description: string }> = {
  rare: { label: "很少", description: "几乎没有或少数情况" },
  sometimes: { label: "有时", description: "部分情况" },
  often: { label: "经常", description: "多数情况" },
  unsure: { label: "不确定", description: "暂时无法判断" },
  not_applicable: { label: "没有相关经历", description: "最近未遇到这种情况" },
};
export const QUESTIONNAIRE_QUESTIONS: { id: string; dimension: TraitDimension; text: string }[] = [
  { id: "q1", dimension: "action_execution", text: "任务要求已经明确、也具备开始条件时，你会实际动手做第一步。" },
  { id: "q2", dimension: "action_execution", text: "暂时做不出完整成果时，你会先完成一个可以修改的初版。" },
  { id: "q3", dimension: "action_execution", text: "任务被中断后，你会在下一次有空时继续推进。" },
  { id: "q4", dimension: "planning", text: "面对需要多个步骤完成的任务，你会把它拆成几个具体的小任务。" },
  { id: "q5", dimension: "planning", text: "任务的步骤互相影响时，你会先确认哪些步骤必须先完成。" },
  { id: "q6", dimension: "planning", text: "开始一个阶段前，你会明确做到什么程度才算完成。" },
  { id: "q7", dimension: "time_management", text: "开始有截止时间的任务前，你会估计它需要多少时间。" },
  { id: "q8", dimension: "time_management", text: "安排交付时间时，你会为检查或意外情况留出时间。" },
  { id: "q9", dimension: "time_management", text: "发现进度比预期慢时，你会重新安排剩余时间。" },
  { id: "q10", dimension: "reflection", text: "完成重要任务后，你会回看哪些具体做法影响了结果。" },
  { id: "q11", dimension: "reflection", text: "回顾一次经历时，你会确定下次可以改变的一项具体做法。" },
  { id: "q12", dimension: "reflection", text: "再次遇到类似任务时，你会检查上次提出的调整是否有效。" },
  { id: "q13", dimension: "exploration", text: "有时间尝试、失败成本也能承受时，你会尝试自己不熟悉的方法。" },
  { id: "q14", dimension: "exploration", text: "不确定新方法是否适合自己时，你会先进行小范围试用。" },
  { id: "q15", dimension: "exploration", text: "原来的方法效果不理想时，你会寻找其他可尝试的方法。" },
];
export type QuestionnaireAnswers = Partial<Record<string, QuestionnaireAnswer>>;

export function isTraitDimension(value: unknown): value is TraitDimension {
  return TRAIT_DIMENSIONS.some((dimension) => dimension === value);
}
export function isTraitLevel(value: unknown): value is TraitLevel {
  return typeof value === "string" && Object.hasOwn(TRAIT_LEVEL_DETAILS, value);
}
export function isQuestionnaireAnswer(value: unknown): value is QuestionnaireAnswer {
  return typeof value === "string" && Object.hasOwn(ANSWER_DETAILS, value);
}
export function questionnaireExcerpt(questionId: string, answer: QuestionnaireAnswer): string {
  const question = QUESTIONNAIRE_QUESTIONS.find((item) => item.id === questionId);
  if (!question || !isQuestionnaireAnswer(answer)) throw new Error("问卷回答无效。");
  return `${question.text} 回答：${ANSWER_DETAILS[answer].label}。范围：最近四周的学习或项目任务。`;
}

// Product summary rule, not a calibrated psychological scale. User reviews the result.
export function suggestTraitLevel(answers: (QuestionnaireAnswer | undefined)[]): TraitLevel {
  const available = answers.filter((answer) => answer === "rare" || answer === "sometimes" || answer === "often");
  if (available.length < 2) return "unknown";
  if (available.includes("rare") && available.includes("often")) return "varied";
  const majority = available.find((answer) => available.filter((item) => item === answer).length >= 2);
  return majority === "rare" ? "low" : majority === "sometimes" ? "medium" : majority === "often" ? "high" : "varied";
}

export function buildQuestionnaireInsights(answers: QuestionnaireAnswers, levels: Partial<Record<TraitDimension, TraitLevel>>, answeredAt: string): ProfileInsight[] {
  if (Number.isNaN(Date.parse(answeredAt)) || answeredAt.length > 50 ||
      Object.entries(answers).some(([id, answer]) => !QUESTIONNAIRE_QUESTIONS.some((item) => item.id === id) || !isQuestionnaireAnswer(answer)) ||
      Object.entries(levels).some(([dimension, level]) => !isTraitDimension(dimension) || !isTraitLevel(level))) {
    throw new Error("问卷资料或当前档位无效。");
  }
  return TRAIT_DIMENSIONS.flatMap((dimension) => {
    const questions = QUESTIONNAIRE_QUESTIONS.filter((question) => question.dimension === dimension);
    if (!questions.some((question) => ["rare", "sometimes", "often"].includes(answers[question.id] ?? ""))) return [];
    const evidence = questions.flatMap((question) => {
      const answer = answers[question.id];
      return answer ? [{ kind: "questionnaire" as const, version: 1 as const, questionId: question.id, answer, answeredAt, excerpt: questionnaireExcerpt(question.id, answer) }] : [];
    });
    return [{ id: crypto.randomUUID(), dimension, statement: `最近四周学习或项目中的${TRAIT_DETAILS[dimension].label}自述：` + questions.flatMap((question) => {
      const answer = answers[question.id];
      return answer ? [`${question.text.replace(/。$/u, "")}（${ANSWER_DETAILS[answer].label}）`] : [];
    }).join("；"), origin: "user_statement" as const, status: "confirmed" as const, scope: "current_state" as const,
    currentLevel: levels[dimension] ?? suggestTraitLevel(questions.map((question) => answers[question.id])), evidence }];
  });
}
