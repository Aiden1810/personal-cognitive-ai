import test from "node:test";
import assert from "node:assert/strict";
import { selectMemorySummarySources, parseMemorySummaryOutput, generateMemorySummary } from "../src/lib/profile/summary.ts";
import { buildQuestionnaireInsights } from "../src/lib/profile/questionnaire.ts";
import type { ReflectionSource } from "../src/lib/profile/reflection.ts";

const source: ReflectionSource = { id: "i1", dimension: "planning", statement: "合成资料：做项目时先拆步骤", quotes: ["做项目时先拆步骤"] };

test("memory summary keeps its separate 20-record limit", async () => {
  const [record] = buildQuestionnaireInsights({ q4: "often", q5: "often", q6: "sometimes" }, {}, "2026-01-01T00:00:00.000Z");
  const records = Array.from({ length: 100 }, (_, index) => ({ ...record, id: `i${index}` }));
  const selected = selectMemorySummarySources(records, []);
  assert.equal(selected.length, 20);
  assert.equal(selected[0].id, "i80");
  await assert.rejects(() => generateMemorySummary(Array.from({ length: 21 }, (_, index) => ({ ...source, id: `i${index}` })), { apiKey: undefined, model: "deepseek-flash" }), /过多/);
});

test("summaries select only confirmed records with intact evidence and retain questionnaire dates", () => {
  const records = buildQuestionnaireInsights({ q4: "often", q5: "often", q6: "sometimes" }, {}, "2026-01-01T00:00:00.000Z");
  const selected = selectMemorySummarySources([...records, { ...records[0], id: "pending", status: "candidate" }, { ...records[0], id: "archived", status: "archived" }], []);
  assert.equal(selected.length, 1);
  assert.deepEqual(selected[0].questionnaireAnsweredAt, ["2026-01-01T00:00:00.000Z"]);
  assert.deepEqual(selectMemorySummarySources([{ ...records[0], evidence: [] }], []), []);
});

test("summary sections cannot cite absent sources or silently accept malformed output", () => {
  const output = { sections: [{ title: "项目做法", text: "你自述做项目时先拆步骤。", insightIds: ["i1"] }] };
  assert.deepEqual(parseMemorySummaryOutput(output, [source]), output);
  assert.throws(() => parseMemorySummaryOutput({ sections: [{ ...output.sections[0], insightIds: ["invented"] }] }, [source]), /引用/);
  assert.throws(() => parseMemorySummaryOutput({ sections: [{ ...output.sections[0], insightIds: [] }] }, [source]), /引用/);
  assert.throws(() => parseMemorySummaryOutput({ sections: [{ ...output.sections[0], text: "" }] }, [source]), /格式/);
  assert.deepEqual(parseMemorySummaryOutput({ sections: [] }, [source]), { sections: [] });
});

test("generation uses existing model transport and validates the real model JSON", async () => {
  let sent: { messages: { role: string; content: string }[] } | undefined;
  const result = await generateMemorySummary([source], { apiKey: "synthetic-key", model: "deepseek-flash", fetcher: async (_url, init) => {
    sent = JSON.parse(String(init?.body));
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ sections: [{ title: "项目", text: "先拆步骤。", insightIds: ["i1"] }] }) } }] });
  } });
  assert.equal(result.sections[0].text, "先拆步骤。");
  assert.equal(JSON.parse(sent!.messages.at(-1)!.content).insights[0].id, "i1");
  assert.ok(!sent!.messages[0].content.includes(source.quotes[0]));
  await assert.rejects(() => generateMemorySummary([source], { apiKey: undefined, model: "deepseek-flash" }), /API Key/);
  await assert.rejects(() => generateMemorySummary([source], { apiKey: "synthetic", model: "deepseek-flash", fetcher: async () => Response.json({ choices: [{ message: { content: "not json" } }] }) }), /格式/);
});
