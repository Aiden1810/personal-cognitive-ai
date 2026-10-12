import { stat } from "node:fs/promises";
import { join, sep } from "node:path";
import { MODEL_DIMENSIONS, MODEL_FILES, MODEL_ID, MODEL_MAX_TOKENS, MODEL_PATH, MODEL_REVISION, MODEL_ROOT } from "./model-config.ts";

export { MODEL_ID } from "./model-config.ts";

type Extractor = (texts: string[], options: {
  pooling: "mean"; normalize: true;
}) => Promise<{ tolist(): unknown }>;

let extractorPromise: Promise<Extractor> | undefined;

function vectorNorm(vector: number[]): number {
  if (!Array.isArray(vector) || vector.length === 0 || vector.some((value) => !Number.isFinite(value))) {
    throw new Error("向量必须是非空的有限数值数组。");
  }
  const norm = Math.hypot(...vector);
  if (norm === 0 || !Number.isFinite(norm)) throw new Error("向量不能为零或包含无法计算的数值。");
  return norm;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    throw new Error("余弦相似度需要维度相同的向量。");
  }
  const normA = vectorNorm(a);
  const normB = vectorNorm(b);
  const similarity = a.reduce((sum, value, index) => sum + (value / normA) * (b[index] / normB), 0);
  return Math.max(-1, Math.min(1, similarity));
}

export function validateEmbeddingVectors(value: unknown, expectedCount: number): number[][] {
  if (!Array.isArray(value) || value.length !== expectedCount) {
    throw new Error("模型返回的向量数量与输入不一致。");
  }
  for (const vector of value) {
    if (!Array.isArray(vector) || vector.length !== MODEL_DIMENSIONS) {
      throw new Error(`模型必须返回 ${MODEL_DIMENSIONS} 维句子向量。`);
    }
    vectorNorm(vector);
  }
  return value as number[][];
}

async function loadExtractor(): Promise<Extractor> {
  // Missing models fail before importing the runtime or touching the network.
  for (const file of MODEL_FILES) {
    try {
      const info = await stat(join(MODEL_PATH, file));
      if (!info.isFile() || info.size === 0) throw new Error("missing file");
    } catch {
      throw new Error("本地语义模型尚未准备。请先运行 node scripts/prepare-semantic-model.ts。");
    }
  }
  const { pipeline, env } = await import("@huggingface/transformers");
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.localModelPath = MODEL_ROOT + sep;
  env.useFSCache = false;
  env.fetch = async () => { throw new Error("本地 embedding 推理禁止联网。"); };
  const extractor = await pipeline("feature-extraction", MODEL_ID, {
    revision: MODEL_REVISION,
    dtype: "q8",
    device: "cpu",
    local_files_only: true,
  });
  // v4's pipeline only forwards padding/truncation. model_max_length is a getter
  // backed by this public config, so bound that config rather than call options.
  extractor.tokenizer.config.model_max_length = MODEL_MAX_TOKENS;
  if (extractor.tokenizer.model_max_length !== MODEL_MAX_TOKENS) {
    throw new Error("无法设置模型的 128 token 输入限制。");
  }
  return extractor as Extractor;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!Array.isArray(texts) || texts.length > 101) throw new Error("单批最多允许 101 条文本。");
  for (const text of texts) {
    if (typeof text !== "string" || !text.trim()) throw new Error("embedding 文本不能为空。");
    if (text.length > 1200) throw new Error("单条文本最多允许 1200 个字符。");
  }
  if (texts.length === 0) return [];
  extractorPromise ??= loadExtractor().catch((error: unknown) => {
    extractorPromise = undefined;
    throw error;
  });
  const extractor = await extractorPromise;
  // No text or text-to-vector cache: personal inputs remain in this Node process.
  const output = await extractor(texts, {
    pooling: "mean", normalize: true,
  });
  return validateEmbeddingVectors(output.tolist(), texts.length);
}
