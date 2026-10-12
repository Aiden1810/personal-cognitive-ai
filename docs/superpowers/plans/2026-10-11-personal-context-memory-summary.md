# 自由背景与记忆摘要实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline; 用户已直接要求添加，保持现有功能分支与未提交改动，不提交、推送或部署。

**Goal:** 用户能自由填写个人背景和回答要求，开启后用于后续聊天，并查看有来源的分类记忆摘要。

**Architecture:** 扩展现有 ResponsePreferenceState 的可选 personalContext，同一存储入口和快照兼容旧版本。背景最多3000字、回答要求最多2000字；画像/目标/快捷偏好保留原3000字符预算，个人设置另行校验上限。记忆摘要读取最多20条有效确认记录，复用已有模型传输，生成按话题分组的临时摘要，不写成新事实；来源变化后隐藏旧摘要。

**Tech Stack:** 现有 Next.js、React、TypeScript、Node test；不新增依赖。

**Spec:** 本对话用户对图二自由背景/回答方式设置与图一记忆摘要的明确请求；已存在候选审核与可选自动整理，继续保持用户确认边界。

## Global Constraints

- Windows PowerShell；只增量修改，不覆盖已有工作。
- 背景自述、正式目标、AI候选与已确认记忆分别处理。
- 自定义要求作为用户资料，不覆盖系统规则、不赋予联网/执行/发消息工具。
- 保存开启后才读取；停用/清空后不再发送，新对话与刷新保留。
- 旧备份缺省个人设置；新设置进入现有快照，校验失败不改旧资料。
- 摘要不是事实或后台学习；缺少配置/请求失败明确报错，不生成假AI摘要。

## Review Focus

- 编辑快捷偏好不能丢背景；编辑背景不能重置快捷偏好。
- 停用、清空以及本次明确不使用个人背景时，请求不发送对应内容。
- 任意引号/换行作为数据传递，不能生成新system消息或变成正式目标。
- 删除、编辑、归档来源后，旧摘要不能继续显示被删除资料。
- 模型摘要的引用编号只能来自本次输入；旧问卷时间范围保留。

## Task 1: 个人设置与聊天

- [x] 新增 personal-context 测试：保存/刷新、双向保留、停用清空、损坏/超长、备份兼容与回滚、聊天附加字段和当次排除、系统角色边界。
- [x] 扩展 src/lib/preferences/store.ts、client.ts；personalContext 包含 enabled/background/instructions/updatedAt。
- [x] 接入 selectChatContext、requestAssistantReply、parseChatRequest 和模型消息；背景是自述，未来希望不变成已实现事实。

## Task 2: 记忆摘要

- [x] 新增 memory-summary 测试：来源引用校验、空/超限、旧问卷日期、模型失败与本地路由限制。
- [x] 新增 src/lib/profile/summary.ts 与 summary-api.ts，复用 ReflectionSource 输入和 requestModelCompletion。
- [x] 新增 /api/profile/summary：本地来源限制、production关闭、正文与字段上限。
- [x] 最多四组简短话题摘要，每组有原始记录引用；只供展示，不持久化为记忆。

## Task 3: 界面与验证

- [x] 我的画像增加背景/回答要求自由输入区及记忆摘要；引用可定位原记录，以现有操作修改、删除。
- [x] 聊天设置和本次参考资料显示实际读取的个人设置；保持原布局与五项主线。
- [x] 真实浏览器用合成资料核对保存、停用、清空、刷新、聊天、摘要及来源失效；手机布局和备份。
- [x] 测试、typecheck、lint、build；独立审查后修复重要问题，更新 README/产品边界和使用说明。

## 执行记录

- 已读当前 README、产品方向、AGENTS 和项目背景说明。沿用已授权功能分支增量执行，保持旧资料和现有未提交修改。
- Task 1: complete；自由设置与快捷偏好互相保留，旧备份兼容，启用/停用/当次排除及请求角色边界已验证。
- Task 2: complete；摘要输入只读取有效确认记录，引用校验、错误路径、问卷日期及本地/production限制已验证。
- Task 3: 核心浏览器流程通过；233项测试、lint、typecheck和最终production构建均通过。真实模型已分别通过背景聊天和4条记忆的4组摘要。
- Final review: 独立只读审查发现保存失败卸载表单、丢失未保存草稿。浏览器故障模拟先复现失败，改为在已有有效状态时保留表单并单独显示错误；重试保存通过。
- 实施决定：自由背景不混成自动记忆、不自动建正式目标；摘要按需且临时展示，后续聊天仍读原记录；原位增量执行且不提交混合工作。
