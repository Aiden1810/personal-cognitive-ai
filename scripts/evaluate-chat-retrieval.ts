import { selectChatContext } from "../src/lib/chat/context.ts";
import { usableProfileInsights } from "../src/lib/profile/usable.ts";
import { retrievalCases } from "../tests/fixtures/retrieval-cases.ts";

let passed = 0;
let missing = 0;
let unrelated = 0;
for (const example of retrievalCases) {
  const selected = selectChatContext(example.history, usableProfileInsights(example.insights, example.conversations), example.goals);
  const actual = [...selected.insights.map((item) => `insight:${item.id}`), ...selected.goals.map((item) => `goal:${item.id}`)];
  const expected = [...example.expectedInsightIds.map((id) => `insight:${id}`), ...example.expectedGoalIds.map((id) => `goal:${id}`)];
  const omitted = expected.filter((id) => !actual.includes(id));
  const extra = actual.filter((id) => !expected.includes(id));
  const ok = omitted.length === 0 && extra.length === 0;
  if (ok) passed++;
  missing += omitted.length;
  unrelated += extra.length;
  console.log(`${ok ? "PASS" : "FAIL"} ${example.name} | ${selected.insights.length} 画像 / ${selected.goals.length} 目标 / ${selected.characters} 字符`);
  if (!ok) console.log(`  遗漏：${omitted.join(", ") || "无"}；误选：${extra.join(", ") || "无"}`);
}
console.log(`\n合成案例：${passed}/${retrievalCases.length} 通过；遗漏 ${missing} 条；误选 ${unrelated} 条。`);
console.log("这是固定规则验收样例，不代表真实用户准确率、向量语义检索效果或长期帮助效果。");
if (passed !== retrievalCases.length) process.exitCode = 1;
