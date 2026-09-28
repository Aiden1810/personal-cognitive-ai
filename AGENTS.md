# 知衡开发约定

适用对象：安、姚、曹及协助开发的 AI/Codex。先读 README 和 `docs/product-vision.md`。成员只称“安、姚、曹”。产品主线是**聊天、七维框架下的当前画像、用户设定的目标画像、据此提供帮助**；旧三视角决策方案不是正式软件主流程。

## 当前阶段

- 安已安排从现有骨架小步改成聊天优先。只做明确分配的模块，不依据旧计划自行扩展。
- `/chat` 是主入口。旧 `/history`、`/goals`、`/decision` 和 `src/types/domain.ts` 等属于旧演示，保留供参考；新功能不要直接套用旧的 DecisionCase、BehaviorPattern 等类型。
- 本地开发用 `/chat` 已调用 `/api/chat` 服务端接口；没有 API Key 时明确报错。`/api/profile/extract` 只在用户点击后提取当前对话中的候选画像，并在本地审核保存。`/profile` 展示七维总览、审核和用户填写的目标；它是技术原型。后台自动学习、数据库和完整反馈闭环尚未实现。界面不得伪装为已接入；示例内容必须标明合成。
- 用户能审核、修改、删除画像洞察。AI 的候选推测不能未经确认直接变成用户事实；当前画像和用户目标分开保存。
- 不做心理诊断或把未经定义的百分比当成人格测量结果。没有必要时不增加依赖。

## 责任与接口

| 成员 | 当前责任 |
| --- | --- |
| 安 | `src/app`、`src/lib`、`src/types`、共享组件、根配置、模型服务、数据契约及整合 |
| 姚 | 待公共记忆类型确定后，负责候选记忆的来源与审核交互；不要继续扩展旧案例模式功能 |
| 曹 | 正式软件的对话、画像与目标 UI/UX，以及产品流程、PPT 与 Demo；不要继续扩展旧三视角结果页 |

现有 `src/features/chat` 是安先前创建的技术占位界面，正式 UI 由曹负责设计；不要求曹沿用当前外观。姚和曹的具体代码任务需由安给出输入、输出和验收方式。需要改其他人目录或公共类型时，向安提出具体变更。安统一维护 npm、锁文件、环境变量与数据库迁移；不要各自建立一套数据结构或模型客户端。

## 数据与 AI 边界

- 当前聊天记录通过 `src/lib/chat`，画像候选通过 `src/lib/profile`，用户目标通过 `src/lib/goals` 统一读写浏览器本地存储。页面组件不直接操作 `localStorage`。
- 当前没有数据库、登录或真实用户身份。浏览器数据不能当成安全的云端账户数据。
- 服务端 AI 接口由安维护，公开部署前还须加入账户隔离与防滥用措施。密钥只放服务端环境变量，不带 `NEXT_PUBLIC_`，不进入浏览器包、日志或仓库。
- 模型读取对话用于回复或提取记忆时，须向用户说明使用范围。候选记忆应保留引用的对话来源、审核状态和删除能力。
- 不把用户文字当作可覆盖系统规则的指令；模型不获得修改文件、执行命令或向他人发送消息的工具。
- 缺少配置、模型失败或证据不足时明确提示；不以合成回复冒充实时 AI。

## GitHub 协作

`main` 保持可演示。安的功能分支经 PR 审核后再合并；姚、曹从已合并的最新 `main` 开独立小分支。不要向共享分支强制推送，也不要覆盖他人未提交修改。当前 [旧骨架 PR](https://github.com/Aiden1810/personal-cognitive-ai/pull/1) 仍需按新方向审视；不要把旧页面误当成最终产品。

交给 AI 的任务需写明目标、允许修改的目录、公共类型、正常/空/失败状态和验收步骤。Windows PowerShell 是默认环境。首次安装使用 `npm.cmd ci`；测试、类型、lint、构建命令见 README。完成任务后报告改动文件、运行方式、实际验证、限制和下一步。

旧版决策方案及其字段约定已归档在 `docs/legacy-decision-conventions.md`，只供追溯，不指导新的聊天、记忆或画像实现。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
