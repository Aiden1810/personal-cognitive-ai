# Browser Agent 本地集成 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. No delegation is required.

**Goal:** 在现有聊天中完成可主动启动、取消并显示真实进度的个性化网页检索。

**Architecture:** Next.js 复用个人资料与模型客户端生成计划和最终回复；独立 Python 服务复用已实测 Browser Use 执行层，短轮询回传验证过的结果。

**Tech Stack:** 现有 Next.js/React/TypeScript、Python 3.13、Browser Use 0.13.11、FastAPI、Uvicorn。

**Spec:** `docs/superpowers/specs/2026-10-12-browser-agent-integration.md`

## Global Constraints

- 无公开部署、数据库迁移或第二套个人资料；不改日常聊天接口。
- 本地令牌、环境、缓存、日志和浏览器资料在 D 盘项目内；不输出密钥。
- 保留米白、浅绿、深绿与文字为主的 UI；无新 npm 依赖。
- 每次最多 5 条确认记忆、2 项启用目标，浏览 15 步/240 秒，正常/空/失败均明确。

## Review Focus

- 断开网页或服务后不冒充实时结果。
- 快速取消/重新发送不启动两个浏览器，取消后清理完成才能接受下一个任务。
- 当次排除资料和停用设置不能通过 Agent 通道重新发送。
- 模型生成的 URL 必须来自真实候选，失败保留候选可独立重试整理。
- 刷新/离开页面及切换对话不把迟到结果写入另一段对话。

## Task 1：Python 任务服务

文件：新增 `browser-agent/{app,runner,jobs,schemas}.py`、`scripts/start-browser-agent.ps1` 及 Python 测试；更新依赖锁与说明。

接口：POST `/tasks` 接收 requestId/task/plan；GET `/tasks/{id}` 返回状态、真实事件、候选或错误；DELETE 等待取消与清理；GET `/health`。均要求本地服务令牌。

- [x] 写并运行鉴权、单任务、幂等、取消、失败和候选校验测试，确认缺实现时失败。
- [x] 复用 probe 的运行配置和模型适配，实现任务生命周期与浏览器执行。
- [x] Python 测试、pip check、实际启动与健康检查。

## Task 2：Next.js 桥接与个人资料

文件：新增 `src/types/agent.ts`、`src/lib/agent/{context,model,server,api}.ts`、`src/app/api/agent/tasks/route.ts` 与 `[id]/{route,result/route}.ts`，新增 TS 测试。

接口：创建接收 task/requestId/现有 ChatRequest 的资料字段；返回 Python task。查询/取消转发；整理读取已完成候选并使用冻结的本次资料，返回 reply。

- [x] 写并运行资料排除/预算、计划字段、来源 URL、同源、服务异常及轮询/取消测试。
- [x] 实现校验、计划、整理与本地桥接，复用现有 `parseChatRequest`/`requestModelCompletion`。
- [x] TS 测试、类型检查及真实 API 闭环。

## Task 3：聊天 UI 与验收

文件：修改 `chat-workspace.tsx`；新增 `agent-task-card.tsx` 与范围明确的 CSS；更新 README、`.env.example`。

- [x] 添加用户主动选择的网页查找模式、本次资料范围说明、真实进度/取消/结果整理重试。
- [x] 回复与来源走现有 Store；保留普通聊天和原备份契约。
- [x] 跑全套测试、typecheck、lint、build；用真实浏览器验证启动/空态/执行/结果/取消。
- [x] 写实际验证、限制及 Windows 启动方法，不新增比赛 Demo 或录屏任务。

## 2026-10-13 授权范围调整

- [x] 取消固定资料站名单，同步调整浏览器公开 HTTPS 导航策略、Next.js URL 校验、模型计划和界面说明；保留个人资料、结果证据和任务生命周期契约。
- [x] 新增公开网站返回、特殊及本地地址过滤、DNS 非公网解析和导航前拒绝的回归测试；真实 MDN 搜索、浏览、候选核对及最终整理通过。
- 全面漏洞审查、画像对比 Demo、录屏和 PPT 留待下一步。
