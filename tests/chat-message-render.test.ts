import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";

async function render(role: "user" | "assistant", content: string) {
  assert.ok(existsSync(new URL("../src/features/chat/message-content.ts", import.meta.url)), "聊天消息尚未接入 Markdown 显示组件");
  const { ChatMessageContent } = await import("../src/features/chat/message-content.ts");
  return renderToStaticMarkup(createElement(ChatMessageContent, { role, content }));
}

test("AI course summaries display headings, bold and lists instead of raw markers", async () => {
  const html = await render("assistant", "## 一、总览\n\n- **五大部件**：运算器、控制器、存储器\n- **核心指标**：CPI、MIPS");
  assert.match(html, /<h2>一、总览<\/h2>/);
  assert.match(html, /<ul>.*<li><strong>五大部件<\/strong>/s);
  assert.doesNotMatch(html, /##|\*\*/);
});

test("numbered steps, quotes and inline code retain their structure", async () => {
  const html = await render("assistant", "1. 运行 `python main.py`\n2. 检查结果\n\n> 从最小项目开始。");
  assert.match(html, /<ol>/);
  assert.match(html, /<code>python main.py<\/code>/);
  assert.match(html, /<blockquote>/);
});

test("fenced code keeps multiplication, exponentiation and literal Markdown symbols", async () => {
  const html = await render("assistant", "```python\nvalue = 2 * 3\npower = 2 ** 3\n# comment\nprint('**literal**')\n```");
  assert.match(html, /<pre><code class="language-python">/);
  for (const literal of ["2 * 3", "2 ** 3", "# comment", "**literal**"]) assert.ok(html.includes(literal));
  assert.doesNotMatch(html, /<strong>/);
});

test("ordinary arithmetic and soft line breaks are not stripped from AI text", async () => {
  const html = await render("assistant", "计算：2 * 3 = 6，2 ** 3 = 8，C#。\n下一行。");
  assert.ok(html.includes("2 * 3"));
  assert.ok(html.includes("2 ** 3"));
  assert.ok(html.includes("C#。\n下一行。"));
});

test("user messages remain literal text and escape HTML", async () => {
  const html = await render("user", "## 我的原话 **内容** <script>alert(1)</script>");
  assert.ok(html.includes("## 我的原话 **内容**"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.doesNotMatch(html, /<h2>|<strong>|<script>/);
});

test("AI Markdown cannot create scripts, unsafe links or automatic image requests", async () => {
  const html = await render("assistant", "<script>alert(1)</script>\n\n[点击](javascript:alert%281%29)\n\n![图片](https://example.com/tracker.png)");
  assert.doesNotMatch(html, /<script|<img|javascript:|tracker\.png|onerror=/);
});

test("safe external links render with a separate browsing context", async () => {
  const html = await render("assistant", "[参考资料](https://example.com/notes)");
  assert.match(html, /href="https:\/\/example.com\/notes"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener noreferrer"/);
});
