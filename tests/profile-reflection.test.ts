import test from "node:test";
import assert from "node:assert/strict";
import { generateProfileReflection, parseReflectionOutput, parseReflectionRequest } from "../src/lib/profile/reflection.ts";
import { selectReflectionSources } from "../src/lib/profile/reflection-api.ts";
import { buildQuestionnaireInsights } from "../src/lib/profile/questionnaire.ts";

const insights = [
  { id: "i1", dimension: "behavioral_patterns", statement: "用户习惯提前准备", quotes: ["我会提前准备"] },
  { id: "i2", dimension: "values_and_beliefs", statement: "用户重视灵活性", quotes: ["我重视灵活性"] },
];

test("综合观察接受 100 条有摘录的记录，拒绝第 101 条", () => {
  assert.equal(parseReflectionRequest({ insights }).length, 2);
  assert.equal(parseReflectionRequest({ insights: Array.from({ length: 100 }, (_, index) => ({ ...insights[0], id: `i${index}` })) }).length, 100);
  assert.throws(() => parseReflectionRequest({ insights: [{ ...insights[0], quotes: [] }] }), /无效/);
  assert.throws(() => parseReflectionRequest({ insights: Array.from({ length: 101 }, (_, index) => ({ ...insights[0], id: `i${index}` })) }), /过多/);
});

test("综合观察从传入列表末尾选择 100 条，保留原话和问卷日期", () => {
  const [record] = buildQuestionnaireInsights({ q4: "often", q5: "often", q6: "sometimes" }, {}, "2026-10-13T00:00:00.000Z");
  const records = Array.from({ length: 105 }, (_, index) => ({ ...record, id: `i${index}` }));
  const selected = selectReflectionSources(records);
  assert.equal(selected.length, 100);
  assert.equal(selected[0].id, "i5");
  assert.equal(selected.at(-1)!.id, "i104");
  assert.deepEqual(selected[0].quotes, record.evidence.map(({ excerpt }) => excerpt));
  assert.deepEqual(selected[0].questionnaireAnsweredAt, ["2026-10-13T00:00:00.000Z"]);
  assert.deepEqual(selectReflectionSources([]), []);
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
