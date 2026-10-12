import { resolve, join } from "node:path";

export const MODEL_ID = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";
export const MODEL_REVISION = "2c4055b";
export const MODEL_DIMENSIONS = 384;
export const MODEL_MAX_TOKENS = 128;
export const MODEL_ROOT = resolve(process.cwd(), ".cache", "semantic-model", MODEL_REVISION);
export const MODEL_PATH = join(MODEL_ROOT, MODEL_ID);
export const MODEL_FILES = [
  "config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "special_tokens_map.json",
  "onnx/model_quantized.onnx",
] as const;
export const MODEL_WEIGHT_SHA256 = "66fc00f5f29afcaff34092e1bdd20008ca3918265a82fb9695a551e510cc4ebc";
