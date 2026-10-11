import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { cosineSimilarity, embedTexts, validateEmbeddingVectors } from "../src/lib/retrieval/local-embedder.ts";

test("cosine similarity distinguishes aligned, opposite, and unrelated vectors", () => {
  assert.equal(cosineSimilarity([3, 4], [6, 8]), 1);
  assert.equal(cosineSimilarity([1, 0], [-1, 0]), -1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
});

test("cosine similarity rejects invalid shape, non-finite values, and zero vectors", () => {
  for (const [a, b] of [[[], []], [[1], [1, 2]], [[NaN], [1]], [[Infinity], [1]], [[0, 0], [1, 0]]]) {
    assert.throws(() => cosineSimilarity(a, b));
  }
});

test("model outputs must contain one finite nonzero 384-dimensional vector per input", () => {
  const vector = [1, ...Array<number>(383).fill(0)];
  assert.deepEqual(validateEmbeddingVectors([vector], 1), [vector]);
  for (const value of [[], [[1, 2]], [Array<number>(384).fill(0)], [[NaN, ...Array<number>(383).fill(0)]], [vector, vector]]) {
    assert.throws(() => validateEmbeddingVectors(value, 1));
  }
});

test("input bounds are enforced before loading a model and empty batches do no work", async () => {
  assert.deepEqual(await embedTexts([]), []);
  await assert.rejects(embedTexts(Array<string>(102).fill("短文本")), /101/);
  await assert.rejects(embedTexts(["长".repeat(1201)]), /1200/);
  await assert.rejects(embedTexts(["   "]), /空/);
});

test("missing local models fail before any fetch, independent of installed transformer library", async () => {
  const directory = await mkdtemp(join(tmpdir(), "zhiheng-embedding-"));
  try {
    const moduleUrl = new URL("../src/lib/retrieval/local-embedder.ts", import.meta.url).href;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", `
      import assert from 'node:assert/strict';
      let calls = 0;
      globalThis.fetch = async () => { calls += 1; throw new Error('network forbidden'); };
      const { embedTexts } = await import(${JSON.stringify(moduleUrl)});
      await assert.rejects(embedTexts(['合成样本']), /prepare-semantic-model/);
      assert.equal(calls, 0);
    `], { cwd: directory, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
