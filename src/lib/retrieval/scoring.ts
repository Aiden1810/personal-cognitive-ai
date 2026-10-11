import { cosineSimilarity, embedTexts, MODEL_ID } from "./local-embedder.ts";
import type { SemanticMatches } from "./hybrid.ts";

export interface SemanticTextRecord { id: string; text: string }
export interface SemanticInput { query: string; insights: SemanticTextRecord[]; goals: SemanticTextRecord[] }

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textRecords(value: unknown): SemanticTextRecord[] {
  if (!Array.isArray(value)) throw new Error("语义检索资料格式无效。");
  const seen = new Set<string>();
  return value.map((item) => {
    if (!record(item) || Object.keys(item).some((key) => !["id", "text"].includes(key)) ||
      typeof item.id !== "string" || !item.id.trim() || item.id.length > 100 ||
      typeof item.text !== "string" || !item.text.trim() || item.text.length > 1200 || seen.has(item.id)) {
      throw new Error("语义检索仅接受不重复的编号和简短描述。");
    }
    seen.add(item.id);
    return { id: item.id, text: item.text };
  });
}

export function parseSemanticInput(value: unknown): SemanticInput {
  if (!record(value) || Object.keys(value).some((key) => !["query", "insights", "goals"].includes(key)) ||
    typeof value.query !== "string" || !value.query.trim() || value.query.length > 1200) {
    throw new Error("语义检索问题须为 1–1200 字符，且不能包含其他字段。");
  }
  const insights = textRecords(value.insights);
  const goals = textRecords(value.goals);
  if (insights.length + goals.length > 100 ||
    value.query.length + [...insights, ...goals].reduce((sum, item) => sum + item.text.length, 0) > 20000) {
    throw new Error("语义检索实验最多处理 100 条资料，合计 20000 字符。");
  }
  return { query: value.query, insights, goals };
}

export async function scoreSemanticInput(
  input: SemanticInput,
  embedder: (texts: string[]) => Promise<number[][]> = embedTexts,
): Promise<SemanticMatches> {
  const valid = parseSemanticInput(input);
  const texts = [valid.query, ...valid.insights.map((item) => item.text), ...valid.goals.map((item) => item.text)];
  const vectors = await embedder(texts);
  if (vectors.length !== texts.length) throw new Error("语义模型返回了不完整的向量。");
  return {
    model: MODEL_ID,
    insights: Object.fromEntries(valid.insights.map((item, index) => [item.id, cosineSimilarity(vectors[0], vectors[index + 1])])),
    goals: Object.fromEntries(valid.goals.map((item, index) => [item.id, cosineSimilarity(vectors[0], vectors[valid.insights.length + index + 1])])),
  };
}
