import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { fileURLToPath } from "node:url";
import { MODEL_FILES, MODEL_ID, MODEL_PATH, MODEL_REVISION, MODEL_WEIGHT_SHA256 } from "../src/lib/retrieval/model-config.ts";

async function fileReady(path: string): Promise<boolean> {
  try { const info = await stat(path); return info.isFile() && info.size > 0; } catch { return false; }
}

async function weightHash(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

export async function prepareSemanticModel(): Promise<void> {
  console.log("下载公开模型文件（约 135 MB）；此脚本不读取或上传聊天、画像、密钥。");
  for (const file of MODEL_FILES) {
    const destination = join(MODEL_PATH, file);
    if (await fileReady(destination)) {
      if (file.endsWith(".onnx") && await weightHash(destination) !== MODEL_WEIGHT_SHA256) {
        throw new Error("已存在的模型权重 SHA-256 不匹配，请移走该文件后重新准备。");
      }
      console.log(`已存在：${file}`);
      continue;
    }
    await mkdir(dirname(destination), { recursive: true });
    const temporary = destination + ".download";
    const url = `https://huggingface.co/${MODEL_ID}/resolve/${MODEL_REVISION}/${file}`;
    console.log(`下载：${file}`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10 * 60 * 1000) });
      if (!response.ok || !response.body) throw new Error(`模型下载失败：HTTP ${response.status}`);
      await pipeline(Readable.fromWeb(response.body as NodeReadableStream<Uint8Array>), createWriteStream(temporary));
      if (!await fileReady(temporary)) throw new Error("下载返回了空文件。");
      if (file.endsWith(".onnx")) {
        if (await weightHash(temporary) !== MODEL_WEIGHT_SHA256) throw new Error("模型权重 SHA-256 不匹配。");
      } else {
        const { readFile } = await import("node:fs/promises");
        JSON.parse(await readFile(temporary, "utf8"));
      }
      await rename(temporary, destination);
    } finally {
      await rm(temporary, { force: true });
    }
  }
  console.log(`模型已准备：${MODEL_PATH}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  prepareSemanticModel().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "准备语义模型失败。");
    process.exitCode = 1;
  });
}
