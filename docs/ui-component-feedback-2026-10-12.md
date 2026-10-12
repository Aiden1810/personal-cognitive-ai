# 组件操作反馈改进

日期：2026 年 10 月 12 日。安已授权按 Designeer 调研改善组件操作手感。沿用米白、浅绿和深绿，以及当前文字导航；本轮不更换组件库，不增加依赖，不修改 Store、AI 请求或问卷规则。

## 依据与实现

参考 [UI Playbook 的按钮状态](https://uiplaybook.dev/play/button)和[有目的的动效原则](https://uiplaybook.dev/play/motion)，以及安装版本 Next.js 的 View Transitions 指南。该指南明确指出：动画期间 named participant 仍会跳过点击。Motion Primitives 和 Base UI 已在上一轮核对来源/许可，本轮没有复制其代码或为小组件全面引入 Motion/Tailwind。

- **按钮与输入框**：普通按钮取消统一悬停放大，主要操作按钮在精确指针下保留轻微反馈；禁用、忙碌、键盘焦点状态更明确。发送按钮保留稳定的最小宽度和单行文案，避免“等待回复”挤换行。输入框只显示一层焦点边框。
- **资料和设置面板**：使用原生 CSS 透明度、位移和离散 display 过渡，移除频繁开合处的 React ViewTransition，保留已有内部组件。功能式 state 更新处理连续点击；关闭即 inert，Escape 回入口，原生 select 和中文输入组合键保持自身行为。
- **对话菜单**：打开即聚焦操作项；记录真正的打开按钮。Escape、Tab/Shift+Tab 回到相应入口或相邻控制；点击外部、滚动和调整窗口时关闭。菜单保留最后坐标与 DOM，用 CSS 完成退出，关闭后不可点击或进入键盘顺序。截图复查发现 sticky 侧栏层级低于聊天内容，已提高聊天侧栏层级；菜单伸出侧栏的部分完整可见，右侧命中测试通过。
- **目标表单**：两种显示状态用 CSS Grid 连续调整高度；打开聚焦文字框，取消/保存回入口。原生 select 的 Escape 不取消表单；编辑时切换维度继续保留草稿。
- **聊天建议中的复用表单**：外层负责 editor 卸载后的焦点恢复。正常取消回入口，入口因失效/错误禁用时回卡片，完成后回结果提示。此修改不执行或自动确认建议。
- **减少动态效果和触屏**：补上 `details::details-content` 的减少动态效果规则；粗指针下增加按钮/summary 最小高度、显示更多操作，并预留标题空间。

## 本轮文件

| 文件 | 目的 |
| --- | --- |
| `src/app/motion.css` | 状态反馈、CSS 面板/菜单过渡、表单高度变化、减少动态效果及触屏样式 |
| `src/features/chat/chat-workspace.tsx` | 面板即时开合、关闭 inert、组合键保护、忙碌语义和发送文案 |
| `src/features/chat/conversation-list-item.tsx` | 真实 opener、键盘退出、点击外部/滚动关闭 |
| `src/features/profile/goal-editor.tsx` | 输入聚焦、取消/保存焦点、表单高度过渡 |
| `src/features/chat/chat-suggestion-card.tsx` | 复用表单卸载和失效情况下的焦点恢复 |
| `README.md`、本文 | 操作与验收记录 |

## 验证

- 281 项既有测试通过，0 项失败。
- 类型检查、lint 和生产构建均通过，收尾修改后的复核同样通过。
- 实际浏览器检查通过：菜单两种 opener 的 Escape，Tab/Shift+Tab 顺序，12 次连续参考面板开合，外部点击打开设置，select 的 Escape，偏好草稿关闭/重开，目标表单自动聚焦，空目标禁止保存，跨维度草稿保留，Escape 与取消回入口。
- 独立审查发现的复用表单外层焦点恢复、入口禁用时的 fallback 及折叠伪元素减少动态效果遗漏均已修复，收尾审查未发现剩余明确问题。
- 本轮浏览器共 21 个断言通过；1280×720 与 390×844 页面未发现横向溢出，窄屏菜单没有越界，窗口调整会关闭菜单并保留入口焦点，菜单右侧未被聊天内容遮住。以上操作期间没有新增 console error，结果见 `output/component-feedback-2026-10-12/qa-results.json`。

浏览器断言结果和截图放在忽略目录 `output/component-feedback-2026-10-12/`。本轮不保存测试目标、删除对话或发送真实模型请求。未专项验收聊天 AI 建议的实际生成/确认过程、系统减少动态效果模式和真实触屏设备。页面与画像切换仍使用既有 ViewTransition，上一轮记录的动画中止兼容边界不能据此宣称全部消除。

## 运行与手工检查

```powershell
. .\scripts\use-project-node.ps1
npm.cmd run dev -- --port 3001
```

打开 `/chat`，连续开合参考资料与设置；打开对话更多操作，用 Escape、Tab、Shift+Tab 检查焦点。到 `/profile` 设置目标，输入临时文字，切换维度后返回，再按 Escape 取消。后续可在真实触屏和减少动态效果设置下专项核对。
