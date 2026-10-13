import assert from "node:assert/strict";
import test from "node:test";
import { parseAgentRequest, parseSearchPlan, parseRecommendations, formatAgentReply, requestedResourceLimit } from "../src/lib/agent/model.ts";

const resource = { url: "https://docs.python.org/3/tutorial/", title: "The Python Tutorial", excerpt: "Python is an easy to learn", visitedAt: "2026-10-12T00:00:00Z" };

test("explicit simple resource counts bound the final response", () => {
  assert.equal(requestedResourceLimit("帮我找一份 Python 官方学习资料"), 1);
  assert.equal(requestedResourceLimit("推荐两份适合我的教程"), 2);
  assert.equal(requestedResourceLimit("查找适合我的资料"), 3);
  const second = { ...resource, url: "https://docs.python.org/3/tutorial/introduction.html" };
  assert.throws(() => parseRecommendations({ summary: "资料", recommendations: [resource, second].map((item) => ({ url: item.url, reason: "相关", limitations: "" })) }, [resource, second], 1));
});

test("agent request rejects unconfirmed memories and overlong tasks", () => {
  assert.throws(() => parseAgentRequest({ requestId: "bad", task: "找资料", insights: [], goals: [] }));
  assert.throws(() => parseAgentRequest({ requestId: "5be5145e-232b-4283-aa1e-728b16a80dbd", task: "x".repeat(2001), insights: [], goals: [] }));
  assert.throws(() => parseAgentRequest({ requestId: "5be5145e-232b-4283-aa1e-728b16a80dbd", task: "找资料", insights: [
    { id: "candidate", dimension: "knowledge_structure", statement: "合成资料", origin: "ai_inference", status: "candidate", evidence: [{ conversationId: "c", messageId: "m", excerpt: "原话" }] },
  ], goals: [] }));
});

test("search plan has bounded nonempty queries and criteria", () => {
  assert.throws(() => parseSearchPlan({ objective: "检索", queries: [], criteria: ["入门"] }));
  assert.throws(() => parseSearchPlan({ objective: "检索", queries: ["   "], criteria: ["入门"] }));
  assert.deepEqual(parseSearchPlan({ objective: "检索", queries: ["Python 入门"], criteria: ["免费"] }).queries, ["Python 入门"]);
});

test("final recommendations cannot invent or duplicate source URLs", () => {
  assert.throws(() => parseRecommendations({ summary: "资料", recommendations: [{ url: "https://invented.example/", reason: "好", limitations: "" }] }, [resource]));
  assert.throws(() => parseRecommendations({ summary: "[隐藏链接](https://invented.example)", recommendations: [{ url: resource.url, reason: "好", limitations: "" }] }, [resource]));
  const selected = parseRecommendations({ summary: "先从官方教程开始", recommendations: [{ url: resource.url, reason: "适合了解基础", limitations: "英文资料" }] }, [resource]);
  const reply = formatAgentReply(selected, [resource]);
  assert.ok(reply.includes(resource.url));
  assert.ok(reply.includes(resource.excerpt));
  assert.ok(reply.includes("英文资料"));
});

test("source text keeps meaningful symbols and URL parentheses do not break markdown links", () => {
  const source = { ...resource, url: "https://docs.python.org/3/tutorial/(sample)", excerpt: "Use __init__ and * for multiplication." };
  const result = parseRecommendations({ summary: "资料", recommendations: [{ url: source.url, reason: "原文", limitations: "" }] }, [source]);
  const reply = formatAgentReply(result, [source]);
  assert.ok(reply.includes("\\_\\_init\\_\\_"));
  assert.ok(reply.includes("\\*"));
  assert.ok(reply.includes("/%28sample%29)"));
});
