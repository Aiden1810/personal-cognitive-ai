import { selectChatContext } from "../src/lib/chat/context.ts";
import { usableProfileInsights } from "../src/lib/profile/usable.ts";
import { retrievalChallenges } from "../tests/fixtures/retrieval-challenge.ts";

let passed = 0;
for (const example of retrievalChallenges) {
  const selected = selectChatContext(example.history, usableProfileInsights(example.insights, example.conversations), example.goals);
  const actualInsights = selected.insights.map((item) => item.id).sort();
  const actualGoals = selected.goals.map((item) => item.id).sort();
  const ok = JSON.stringify(actualInsights) === JSON.stringify([...example.expectedInsights].sort()) && JSON.stringify(actualGoals) === JSON.stringify([...example.expectedGoals].sort());
  if (ok) passed++;
  console.log(`${ok ? "PASS" : "FAIL"} ${example.name}`);
  if (!ok) console.log(`  画像 ${JSON.stringify(actualInsights)} / 期望 ${JSON.stringify(example.expectedInsights)}；目标 ${JSON.stringify(actualGoals)} / 期望 ${JSON.stringify(example.expectedGoals)}`);
}
console.log(`\n独立设计的新合成案例：${passed}/${retrievalChallenges.length} 符合人工预期。`);
console.log("案例用于发现规则缺口；修复后重跑不再是盲测，不代表真实用户准确率。");
if (passed !== retrievalChallenges.length) process.exitCode = 1;
