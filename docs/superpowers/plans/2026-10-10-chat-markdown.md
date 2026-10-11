# 聊天中的 Markdown 显示

用户截图里的 `##` 和 `**` 是模型回复中的 Markdown 标记。原聊天页直接用 `<p>{message.content}</p>` 显示原文，未解析格式，导致标题和加粗的标记直接出现。

## 修改

- 新增标准依赖 `react-markdown@10.1.0`，安装命令 `npm.cmd install react-markdown@10.1.0`，已更新 package.json 和锁文件。用同步 React 组件显示基础 CommonMark，不自行用正则删符号。
- 用户发言保持普通文字；AI 回复按标题、加粗、列表、引用、链接、代码及分隔线显示。所有已有 AI 回复都会进入同一显示组件，无数据迁移。
- 聊天记录、发给模型的历史和复制按钮继续保留原文。数学乘号、代码指数 `**`、注释 `#`、代码里的 Markdown 字面量保留。
- 关闭原始 HTML 和自动图片显示，沿用库的默认 URL 过滤。安全链接在独立浏览上下文打开；测试包含恶意链接和脚本。
- AI 气泡改为一个外层容器，内部段落不再各自套气泡；代码块可横向滚动。仅修改聊天消息样式，不调整页面结构。
- 本轮未增加 GFM 表格、任务列表、数学公式或代码高亮扩展。

官方 API 与行为参考：[react-markdown](https://github.com/remarkjs/react-markdown)。

## 文件

- `src/features/chat/message-content.ts`：只负责消息显示，使用 React createElement，便于同一组件直接参与 Node 渲染测试。
- `src/features/chat/chat-workspace.tsx`：接入显示组件。
- `src/app/refinement.css`：段落、标题、列表、引用和代码样式。
- `package.json`、`package-lock.json`：标准解析组件依赖。
- `tests/chat-message-render.test.ts`：7 项真实 React 标记输出测试。
- `README.md`：记录显示方式和边界。

## 验证

- 7 项专门测试先失败，接入组件后通过。涵盖截图样例、列表、代码字符保留、普通算式与换行、用户原文、HTML/链接/图片边界。
- `npm.cmd test`：186/186 通过。
- `npm.cmd run typecheck`、`npm.cmd run lint`：通过。
- `npm.cmd run build`：最终生产构建通过。
- 浏览器此前保存的权限设置阻止自动访问，本轮未绕行；渲染结果通过 React 服务端标记输出验证，页面视觉仍未浏览器验收。
- 安装后的 `npm audit` 报告 7 项高风险，涉及当前 Next、ESLint 工具链和 source-map-js，报告未列出 react-markdown。相关依赖升级应单独检查，不在此显示修复中执行强制降级或升级。

## 查看

在正在运行的本地服务刷新 `/chat`，打开原有含标题与加粗的 AI 回复，应看到排版而不再露出这些格式标记。用户自己输入的符号和代码中的真实字符仍保留。
