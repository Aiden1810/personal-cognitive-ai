import { writeFile, mkdir } from "node:fs/promises";
import { selectChatContext, retrievalQuery } from "../src/lib/chat/context.ts";
import { usableProfileInsights } from "../src/lib/profile/usable.ts";
import { scoreSemanticInput } from "../src/lib/retrieval/scoring.ts";
import { MODEL_ID, MODEL_REVISION, MODEL_MAX_TOKENS } from "../src/lib/retrieval/model-config.ts";
import { MIN_SEMANTIC_SIMILARITY } from "../src/lib/retrieval/hybrid.ts";
import { semanticRetrievalCases } from "../tests/fixtures/semantic-retrieval-cases.ts";

const started = performance.now();
const results = [];
for (const example of semanticRetrievalCases) {
  const insights = usableProfileInsights(example.insights, example.conversations);
  const baseline = selectChatContext(example.history, insights, []);
  const begin = performance.now();
  const scores = await scoreSemanticInput({ query: retrievalQuery(example.history).question, insights: insights.map(({ id, statement }) => ({ id, text: statement })), goals: [] });
  const selected = selectChatContext(example.history, insights, [], undefined, scores);
  const allowed = example.allowedIds ?? example.expectedIds;
  function assess(ids: string[]) {
    const missing = example.expectedIds.filter((id) => !ids.includes(id));
    const extra = ids.filter((id) => !allowed.includes(id));
    const forbidden = ids.filter((id) => example.forbiddenIds.includes(id));
    return { passed: !missing.length && !extra.length && !forbidden.length, ids, missing, extra, forbidden };
  }
  const result = {
    id: example.id, label: example.label, question: retrievalQuery(example.history).question,
    expected: example.expectedIds, baseline: assess(baseline.insights.map(({ id }) => id)),
    hybrid: assess(selected.insights.map(({ id }) => id)), similarities: scores.insights,
    milliseconds: Math.round(performance.now() - begin),
  };
  results.push(result);
  console.log(`${result.id} 关键词 ${result.baseline.passed ? "PASS" : "FAIL"} / 混合 ${result.hybrid.passed ? "PASS" : "FAIL"}  ${result.label}`);
  if (!result.hybrid.passed) console.log(`  混合选中=${JSON.stringify(result.hybrid.ids)}，漏选=${JSON.stringify(result.hybrid.missing)}，多选=${JSON.stringify(result.hybrid.extra)}`);
}
const baselinePassed = results.filter((item) => item.baseline.passed).length;
const hybridPassed = results.filter((item) => item.hybrid.passed).length;
const report = { model: MODEL_ID, revision: MODEL_REVISION, maxTokens: MODEL_MAX_TOKENS, threshold: MIN_SEMANTIC_SIMILARITY, baselinePassed, hybridPassed, cases: results.length, milliseconds: Math.round(performance.now() - started), results };
await mkdir("output/semantic-retrieval", { recursive: true });
await writeFile("output/semantic-retrieval/evaluation.json", JSON.stringify(report, null, 2));
console.log(`\n合成案例：关键词 ${baselinePassed}/${results.length}；真实本地向量混合 ${hybridPassed}/${results.length}。`);
console.log("人工标注的小样本用于找问题；不代表真实用户准确率。向量相似度不是置信概率。报告：output/semantic-retrieval/evaluation.json");
