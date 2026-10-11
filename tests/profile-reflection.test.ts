import test from "node:test";
import assert from "node:assert/strict";
import { generateProfileReflection, parseReflectionOutput, parseReflectionRequest } from "../src/lib/profile/reflection.ts";

const insights = [
  { id: "i1", dimension: "behavioral_patterns", statement: "用户习惯提前准备", quotes: ["我会提前准备"] },
  { id: "i2", dimension: "values_and_beliefs", statement: "用户重视灵活性", quotes: ["我重视灵活性"] },
];

test("综合观察只接受最多 20 条有摘录的记录", () => {
  assert.equal(parseReflectionRequest({ insights }).length, 2);
  assert.throws(() => parseReflectionRequest({ insights: [{ ...insights[0], quotes: [] }] }), /无效/);
  assert.throws(() => parseReflectionRequest({ insights: Array.from({ length: 21 }, (_, index) => ({ ...insights[0], id: `i${index}` })) }), /过多/);
});

test("模型不能凭空引用画像，张力必须关联两条不同记录", () => {
  const result = parseReflectionOutput({
    strengths: [{ text: "可能有提前准备的习惯", insightIds: ["i1"] }, { text: "编造", insightIds: ["unknown"] }],
    growthAreas: [],
    tensions: [{ text: "需要核对", insightIds: ["i1", "i2"] }, { text: "无效", insightIds: ["i1", "i1"] }],
  }, parseReflectionRequest({ insights }));
  assert.equal(result.strengths.length, 1);
  assert.equal(result.tensions.length, 1);
});

test("Flash 请求只发送已筛选画像与摘录并读取结构化结果", async () => {
  let sent: Record<string, unknown> = {};
  const result = await generateProfileReflection(parseReflectionRequest({ insights }), {
    apiKey: "test", model: "deepseek-flash",
    fetcher: async (_url, init) => {
      sent = JSON.parse(String(init?.body));
      return Response.json({ choices: [{ message: { content: JSON.stringify({ strengths: [{ text: "提前准备", insightIds: ["i1"] }], growthAreas: [], tensions: [] }) } }] });
    },
  });
  assert.equal(sent?.model, "deepseek-flash");
  assert.equal(result.strengths[0].insightIds[0], "i1");
});
