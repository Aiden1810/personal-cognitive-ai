import assert from "node:assert/strict";
import test from "node:test";
import { allowedUrl, parseAgentJob } from "../src/lib/agent/protocol.ts";

test("resource URLs accept public HTTPS websites beyond the original resource list", () => {
  for (const url of ["https://developer.mozilla.org/zh-CN/docs/Web", "https://huggingface.co/learn/", "https://arxiv.org/abs/2401.00001", "https://www.example.com:443/guide"]) {
    assert.equal(allowedUrl(url), true, url);
  }
  assert.equal(allowedUrl("https://www.bing.com/search?q=python"), false);
  assert.equal(allowedUrl("https://www.bing.com/search?q=python", true), true);
});

test("resource URLs reject local destinations, special schemes, credentials and unusual ports", () => {
  for (const url of ["http://example.com/", "file:///D:/notes.txt", "javascript:alert(1)", "https://localhost/", "https://app.localhost/", "https://printer.local/", "https://server.internal/", "https://intranet/", "https://127.0.0.1/", "https://2130706433/", "https://0x7f000001/", "https://[::1]/", "https://8.8.8.8/", "https://user:pass@example.com/", "https://example.com:8001/", "https://example.com\\@localhost/", "https://example.com/\nsecret"]) {
    assert.equal(allowedUrl(url, true), false, url);
  }
});

test("job validation carries a genuinely visited new website through events and resources", () => {
  const at = "2026-10-13T00:00:00Z";
  const url = "https://developer.mozilla.org/zh-CN/docs/Web";
  const job = parseAgentJob({ id: "5be5145e-232b-4283-aa1e-728b16a80dbd", task: "找 Web 学习资料", status: "completed", plan: { objective: "资料", queries: ["Web 学习"], criteria: ["中文"] }, createdAt: at, finishedAt: at, error: null,
    events: [{ sequence: 1, kind: "browse", message: "正在浏览网页", url, title: "Web", at }], resources: [{ url, title: "Web", excerpt: "Learning web development", visitedAt: at }] });
  assert.equal(job.resources[0].url, url);
});
