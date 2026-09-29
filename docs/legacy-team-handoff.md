# 知衡：骨架接续说明

## 先确认版本

骨架 PR 合并到 main 后，姚和曹从最新 main 开始自己的任务。不要各自初始化 Next.js，不需要重新设计数据结构。

安负责公共类型、布局、数据实现、依赖与后续服务端；具体修改权限遵循 AGENTS.md。

## 已实现与未实现

已实现：三个页面路由、统一布局、公共类型、合成占位数据、浏览器保存入口、存储错误提示、状态联动与数据测试。

未实现：完整案例表单、模式审核操作、目标编辑、LLM/分析接口、三视角生成、正式反馈表单、登录和云端数据库。

API 类型仅作为未来契约，目前不存在可调用的 `/api/patterns/analyze` 或 `/api/decisions/compare`。不要把页面中三个说明面板当成已生成的回答。

## 公共数据入口

客户端组件从 `@/lib/data` 导入：

- `useDemoData()`：返回 state、ready、error，以及所有保存动作。state 在加载中或读取失败时可能为 null。
- `createRecordMetadata()`：统一生成 ID、demo-user 和 ISO 时间；配合表单内容构造新记录。
- `demoDataActions`：非 hook 事件需要时可使用相同动作，不接触 localStorage。

动作：saveCase、deleteCase、savePattern、saveGoal、saveComparison、saveFeedback、reset。保存与删除动作返回 true/false；失败已有全局提示，不要照样清空表单或显示成功。

useDemoData 的订阅会更新所有页面，同浏览器标签页之间也会同步。不同电脑没有同步；正式账户与云端保存另开任务。

类型从 `@/types/domain` 导入。记录里的 scenario 当前是 `demo-placeholder`，它只是占位标识；演示场景确定后由安统一更新 fixtures。

## 姚：历史与模式模块

- 分支：feat/history-review。
- 入口：`src/features/history/history-workspace.tsx`。
- 允许在自己的目录拆分案例表单、证据显示和模式审核组件。
- 使用 DecisionCase、BehaviorPattern；saveCase / deleteCase / savePattern。
- 手填案例先明确来源，确认操作与录入分开；模式候选不能伪装成 AI 分析结果。
- 支持/反例显示原始案例。驳回、编辑、删除后读取最新 state。
- 验收：空白表单失败、刷新保留、确认/驳回真实改变状态、反例可见、无模型接口时明确提示。

## 曹：目标、结果和反馈模块

- 分支：feat/decision-ui。
- 入口：`src/features/decision/goals-workspace.tsx`、`decision-workspace.tsx`。
- 使用 ImprovementGoal、CurrentDecision、PerspectiveAnswer、DecisionComparison、DecisionFeedback。
- 目标使用 saveGoal；结果和反馈接口由安完成后再连接。当前可以用明确标识的示例做展示，但不能自行接模型。
- 草稿可用组件 state；正式保存使用公共入口。
- 验收：目标可编辑/停用、无目标时提示、Original Me 标为预测、引用可检查、实际选择与后续结果分开记录。
- 同时推进 PPT / Demo 脚本，不为 UI 新增整套组件库。

## 安：下一核心任务

确定单场景与模型接入，实现 API 契约、独立三视角上下文和引用校验，再交给姚与曹接上操作。当前骨架不默认授权这个下一任务。

## 本地验证

按 README 安装并启动。交付前运行 test、typecheck、lint、build；浏览器走一次自己的模块。PR 写明文件、操作步骤、实际检查结果和未完成部分。

不把 .env、私人案例或截图日志提交到仓库。公共结构不足时向安提出具体缺口，再修改。
