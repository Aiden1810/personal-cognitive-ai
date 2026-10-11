# 2026-10-11 本地工作区整理

本轮仅整理已有改动、修正忽略规则和文档边界，没有增加产品功能。分支保持 `feat/project-foundation`，没有 push、merge、部署、修改远程或执行数据库脚本。

## 安全规则

- `output/` 全部忽略；`.env`、`.env.*`（仅 `.env.example` 例外）、`private-data/` 继续忽略。
- 本轮开始时这些目录没有已跟踪文件；环境文件只跟踪空值模板 `.env.example`。
- 所有暂存使用具体文件清单，没有使用 `git add .` 或 `git add -f`。
- 交叉改动按暂存内容拆分，保留工作区原源码。辅助清单、快照片段和完整检查日志仅放在忽略的 `private-data/workspace-cleanup/`。
- 截图、backup JSON、真实对话和画像没有提交。自动模式的测试资料与检索 fixtures 是静态合成案例。

## 提交切片与文件范围

| 顺序 | 本地提交 | 主要文件范围 |
| --- | --- | --- |
| 1 | `ec5dcf3` — `chore: exclude generated output and private runtime data` | `.gitignore`、`eslint.config.mjs` |
| 2 | `ce9f231` — `fix: preserve storage errors and share chat API contracts` | `src/lib/errors.ts`、`src/lib/storage/`、各旧 Store/client 的错误处理、`src/types/chat-api.ts`、chat API 与对应测试 |
| 3 | `da4f07b` — `feat: add five behavior traits and reviewed onboarding profiles` | 五项类型、问卷与 onboarding、profile/goal、背景与偏好、摘要及审核、相关测试 |
| 4 | `7aac6f4` — `style: apply desktop shell and readable chat messages` | 桌面 CSS、共享 shell/sidebar、聊天布局与 Markdown、对应依赖及测试 |
| 5 | `fd64b32` — `feat: add reviewed AI actions and opt-in semantic retrieval` | 操作建议、已有行动记录代码、默认关闭的语义实验、评估脚本与合成案例、依赖与测试 |
| 6 | `7cb6320` — `feat: add optional accounts and explicit backup snapshots` | account/auth/backup/cloud、`src/proxy.ts`、`database/schema.sql`、`.env.example`、Supabase 依赖与快照兼容测试 |
| 7 | `docs: align project handoffs with current capability boundaries` | README、AGENTS、产品/比赛/交接/功能记录、历史开发记录、本文 |
| 8 | `docs: archive historical contest outlines and speaking draft` | 根目录三份纯文字比赛草稿，注明历史版本及未验收边界；PPT/PDF 跳过 |

共享文件有依赖：第 2 片先提交错误处理；第 3 片加入画像所需的关键词资料选择与聊天契约；第 4 片提交 UI；第 5 片再接入建议卡片和语义请求。备份兼容测试随第 6 片补齐。画像审核组件调用所需的 `conversations` 参数随第 3 片提前暂存。每片均可单独查看差异，后片依赖前片。

## 实际验证

每次本地提交后均运行 `npm.cmd test`、`npm.cmd run lint`、`npm.cmd run typecheck`。源码整理阶段的完整工作区为 281 项测试、0 失败，lint 与 typecheck 通过。

为避免未提交文件掩盖缺失依赖，第 2–6 片另从暂存区导出到隔离临时目录，复用本机已有 `node_modules`，不复制 `.env.local`；各片的测试数量分别为 89、176、183、260、281，均通过 lint 和 typecheck。第 3 片最初缺一个调用参数、第 5 片最初混入备份测试，均仅调整暂存边界后重新通过检查。

本次没有重新安装依赖、调用真实 AI、运行语义模型下载、进行浏览器视觉验收或生产构建；文档中的相关旧记录保留其日期，不作为本轮重新验收的证据。

## 需人工确认，未提交

- `知衡-参赛项目简报-最终版.pptx`：14 页、14 页备注及 1 项嵌入媒体；媒体来源与隐私范围未能确认，跳过整个文件。
- `知衡-参赛项目简报-最终版.pdf`：14 页、14 项嵌入图像；仅提取文本不能确认截图隐私，跳过整个文件。
- `output/` 全部：包括界面截图、比赛截图、backup JSON、渲染图与过程输出。本轮不建立白名单，不把文件名中的 synthetic 当成隐私验证。
- `private-data/` 与 `.env.local`：继续只留本机，不能强制暂存。

三份根目录文字材料是旧草稿，保留为历史记录，不代表本轮已完成新的正式五项画像 PPT 或讲稿；旧比赛名称、分工和时长不能直接沿用。

## 能力与后续 PR 边界

产品主线是可选问卷、聊天、五项行为画像、独立目标和相关帮助。公开 AI、完整云端跨设备流程及 `/progress` 页面尚未验收。SQL 中逐条画像表仍有旧七维约束，JSON 快照兼容不等于逐条云端迁移完成；本轮不改 SQL 结构，也不执行它。

Draft PR #1 是旧骨架，不能因这些提交而认为已经审查或可合并。建议在安允许推送时，用新的当前范围分支开 Draft PR 替换旧 PR，说明历史提交与本轮八片；若希望更小的审查单位，可按依赖顺序拆成多个 PR。需要另行审查相对 `main` 的完整差异，不能只看本轮新增提交。本轮没有创建、关闭或更新远程 PR。

## Windows 运行与复核

已有依赖时在项目根目录执行：

```powershell
npm.cmd run dev -- --port 3001
npm.cmd test
npm.cmd run lint
npm.cmd run typecheck
git log --oneline -8
git status --short --untracked-files=all
git check-ignore -v .env.local private-data/ output/
```

主入口为 `/chat`，真实 AI 仍需仅放在服务端的 `LLM_API_KEY`。首次安装使用 `npm.cmd ci`；本轮没有新增超出现有脏工作区的 dependency。
