# 2026-10-12 当前版本检查与修复

安授权检查并修复当前版本的实际问题。本轮保留现有米白、浅绿、深绿界面、共享数据类型与本地存储格式，没有新增依赖或大型功能。检查结束时改动留在本地；随后安明确授权上传 GitHub。交付沿用 `codex/chat-profile-ready` 分支和 Draft PR #2，不合并 `main` 或部署。

## 已修复的问题

| 问题 | 修复与对应文件 |
| --- | --- |
| 页面卸载期间其他页面修改资料，返回时仍可能读取旧缓存 | 首位订阅者重新挂载时重读存储。`src/lib/chat/client.ts`、`goals/client.ts`、`outcomes/client.ts`、`profile/auto-client.ts`、`profile/assessment-client.ts` |
| 目标、行动保存失败后整块界面被错误提示替换，已输入草稿可能丢失 | 错误提示与有效资料并列显示，保留原表单位置与组件。`src/features/profile/profile-overview.tsx`、`outcomes/outcome-workspace.tsx` |
| 临时存储错误只提供清空，或重试读取时丢失已有状态 | 相关客户端提供非破坏性 `retryLoad`。权限/临时读取失败保留上次有效状态并显示错误；当前资料损坏则不继续使用旧状态。清空入口仅在 `INVALID_STORED_DATA` 时显示。相关客户端及聊天、画像、回答偏好、自由背景面板 |
| 目标读取错误尚未解除时，仍可用缓存旧目标保存行动 | 保留行动草稿，禁用保存并要求重新读取目标。`src/features/outcomes/outcome-editor.tsx`、`outcome-workspace.tsx` |
| 整理期间原对话删除，迟到的候选仍可能被保存 | 保存候选前重新检查当前存储里的原话；原对话删除/改变则拒绝保存。聊天损坏的来源错误不误报成画像损坏。`src/lib/profile/client.ts`、`src/features/profile/profile-review-panel.tsx` |
| 自动整理的迟到结果可能覆盖另一页面的新进度，或在停用后继续保存 | 返回后核对当前开关、请求开始时的 checkpoint 和原话；进度或来源变化则丢弃这次结果。`src/lib/profile/auto.ts`、`src/features/chat/chat-workspace.tsx` |
| 手动整理保存失败缺少明确重试入口 | 明确提示未保存，提供“重试整理”；候选已保存但整理进度失败则分别说明。`src/features/profile/profile-review-panel.tsx` |
| 整理入口需要两层展开 | 聊天标题栏增加“对话记忆”，只打开现有面板并聚焦整理按钮，不自动发送数据。Escape 返回实际触发入口。`src/features/chat/chat-workspace.tsx`、`profile-review-panel.tsx` |
| 手机聊天标题被操作按钮挤成多行，占用消息空间 | 600px 以下标题独占一行并截断，操作按钮另起一行；面板位于标题栏下方。`src/app/chat-desktop.css` |

`src/lib/preferences/client.ts` 与 `src/lib/profile/client.ts` 同样补齐读取恢复行为。`src/features/chat/response-preferences.tsx`、`src/features/profile/personal-context-panel.tsx` 增加重读设置入口。“本次参考资料”仍按安此前确认默认收起，用户确认记忆与独立目标的规则不变。

## 自动验证

- `npm.cmd test`：326 项通过，0 失败；原有 292 项之外新增 34 项。
- `npm.cmd run evaluate:retrieval`：22/22 合成规则案例通过。
- `npm.cmd run evaluate:challenge`：12/12 合成挑战案例通过。
- `npm.cmd run typecheck`、`npm.cmd run lint`、`npm.cmd run build`：通过。
- 最终 production 路由列表没有临时故障验证页。

新增测试为 `tests/storage-remount.test.ts`、`profile-client-recovery.test.ts`、`profile-auto-commit.test.ts`、`form-error-recovery.test.ts`。Store 测试使用真实存储逻辑，仅替换 React hook 边界；表单 SSR 测试只证明错误态继续渲染表单结构，不能单独证明草稿与焦点保留。草稿保留另用已挂载的真实组件在浏览器中验证。

## 本轮浏览器检查

全部在独立 origin `http://127.0.0.1:3002` 使用合成资料，不恢复或修改安原来 3001 地址里的业务资料。截图已保存并查看，留在忽略的 `output/review-2026-10-12/`，不进入公开仓库。短暂添加的故障测试页已移出 `src/`，原件保留为该目录下 `fault-harness.tsx`，最终应用不含故障注入代码。

| 步骤 | 本次结果与证据 |
| --- | --- |
| 1 聊天入口 | “对话记忆”直接展开并聚焦；Escape 返回该按钮。正常。`01-chat.jpg` |
| 2 问卷 | 回答两题并跳过其他题，核对并修改合成摘要后保存；跳题未补成低档。正常。`02-questionnaire.jpg` |
| 3 当前画像与独立目标 | 问卷确认资料保留，另外保存合成文字目标。正常。`03-profile.jpg` |
| 4 行动记录 | 选择目标、填写行动与结果、自评后保存，历史保留当时目标。此单例正常。`04-progress.jpg` |
| 5 真实聊天与来源 | 一次真实模型回复附加 1 条问卷记忆、1 项相关目标；展开可核对，刷新后引用仍保留。真实提取另产生 1 条带原话候选，确认后显示为已确认记录。此单例正常。`05-live-chat.jpg` |
| 6 本地备份 | 导出合成 JSON；导入显示 1 段对话、2 条消息、2 条画像、1 个目标、1 条行动；确认恢复后仍可读取。正常。`06-backup.jpg` |
| 7 目标故障恢复 | 打开真实目标编辑器并输入草稿，注入容量不足；保存失败后草稿仍在。再注入读取拒绝，重试失败仍保留；解除故障并重读后继续保存成功。正常。`07-goal-failure.jpg` |
| 8 行动故障恢复 | 已输入的行动/结果在容量不足与重读后保留。目标读取失败时保存禁用，恢复重读后保存成功。正常。`08-outcome-failure.jpg`（截图主要展示输入保留，错误/禁用状态另由当次 DOM 检查核对） |
| 9 手机聊天 | 390×844 下长标题截断，操作按钮可见；无横向溢出，记忆面板在标题栏下方。正常。`09-mobile-chat.jpg` |

故障验证用合成 QuotaExceededError/SecurityError，不代表已验证所有浏览器的真实容量、权限机制。单次真实模型成功不证明持续可用、普遍回答质量或长期效果。

## 运行与再次核对

```powershell
. .\scripts\use-project-node.ps1
npm.cmd run dev -- --port 3001
```

打开 `/chat`：检查顶部“对话记忆”入口；到 `/profile` 设置目标；到 `/progress` 保存一条行动；到 `/backup` 导出资料。真实 AI 沿用已有服务端配置，不覆盖 `.env.local`。完整检查命令仍以 README 为准。

## 仍需专项验收

- 本轮没有登录真实云端账户、收发验证邮件或做跨设备云端恢复，公开生产 AI 仍按既有规则关闭。
- 行动页只验证本次正常保存与故障恢复，未完成全部流程、六次比较与长期反馈效果验收。
- 本地语义实验的既有漏选/误选、全部自然语言纠正表达和长期个性化效果未因本轮修复而解决。
- 比赛 PPT、提交回执、现场网络和备用录屏不属于本轮代码修复结论。下一步优先用现有版本完整彩排，并另验收确实要演示的云端能力。
