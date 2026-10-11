# 五项行为画像与初始问卷

2026 年 10 月 11 日，安确认将用户主界面收窄为行动力、规划与拆解、时间安排、复盘调整、探索尝试。问卷用于提供可修改的起点，不是经过验证的心理量表。

## 用户流程

1. 新浏览器、尚无聊天/画像/目标时，聊天页展示填写或跳过入口；已有资料的用户从“我的画像”主动填写。
2. `/onboarding` 每组 3 题、共 15 题，询问最近四周学习或项目中的实际行为。选项为很少、有时、经常、不确定、没有相关经历；可跳题、清除答案及返回上一组。
3. 核对页保留原答案，用户可编辑摘要、自评档位，并取消某项。“确认并开始对话”保存后进聊天；“确认并设置目标”进入画像页，自愿设置目标。
4. 当前档位与目标档位分别保存。目标仍需具体文字，可以增加、保持或减少；修改目标不会重写当前画像，也不会把暂停目标自动启用。
5. 重填只归档本次选择保存的同项旧问卷画像，不归档聊天记录、不删除旧依据、不修改目标。没有选择的特质保留旧状态。

未确认的答案只在问卷页面内暂存，刷新或离开会丢失；确认保存后进入现有浏览器存储和备份。返回聊天的链接不标记完成或跳过；主动点击跳过才保存状态。

## 草稿档位规则

- 只使用很少、有时、经常三个行为频率；不确定、不适用和跳过不计低档。
- 少于两条行为频率答案时：暂不确定。
- 同时出现很少和经常，或没有多数时：随情境变化。
- 其余同档出现至少两次时：对应低（较少出现）、中（有时出现）、高（较常出现）。
- 用户在核对页决定是否采用；这些是透明的产品整理规则，没有信度、效度或人群常模验证。各项不相加，不产生总分或百分比。

## 契约与兼容

- `CognitiveDimension` 增加 `action_execution`、`planning`、`time_management`、`reflection`、`exploration`，旧七项仍可读，不自动映射。五项为主导航；已有旧资料与目标在“其他背景与旧资料”访问。
- `ProfileInsight.currentLevel?` 与 `UserGoal.targetLevel?` 使用 low/medium/high/varied/unknown；与 `responseAdaptation` 帮助强度、`willingness` 改变意愿分开。
- `EvidenceReference` 为聊天或问卷来源。问卷包含 `kind: questionnaire`、`version: 1`、`questionId`、`answer`、`answeredAt`、可核对的 `excerpt`；没有虚构 conversationId/messageId。
- `ProfileState.onboarding?` 保存版本和 completed/skipped，仍在原 profile 存储键及同一快照内。旧快照字段可缺省；恢复前完整校验，错误写入回滚仍按已有规则。
- 仅已确认、依据有效且与本次提问相关的记录进入聊天。问卷保留完整选中项目的依据；档位字段计入原请求预算。模型提示要求区分问卷自述和聊天原话，不自动改变档位。
- 聊天与综合观察保留问卷填写日期；“最近四周”指填写日期之前四周，旧问卷需核对是否仍适用，不永久当成当前状态。
- 新候选提取优先五项；知识、关系、价值和经历等作为其他背景保留，不强行填入行为档位。

## 验收（合成资料）

1. 在独立浏览器会话打开 `/chat`，填写问卷或跳过；跳过后刷新不再提示，画像为空。
2. 行动力三题选有时、经常、有时，核对页建议中档；将自评改为低档，修改描述后确认。
3. 画像页查看问卷题目、答案和日期；刷新记录仍在；目标设高档，当前仍低档。暂停目标后再修改，保持暂停。
4. 不确定/不适用/全部跳过不生成低档画像；部分填写只保存有具体自述且用户选择的项目。
5. 重填对应项目后，旧问卷归档仍可查看；其他背景、聊天记录与目标保留。
6. 下载 JSON，在独立测试会话恢复，核对状态与依据；损坏问卷依据应拒绝恢复，原资料保持原样。
7. 用合成问题检查聊天参考范围及请求字段；真实模型表现、真实用户理解和账户跨设备恢复分别验收，不能由单元测试替代。

## 本轮实际验证

- 220 项自动测试通过；覆盖问卷未知/不适用、来源校验、存储失败、重填、目标独立、暂停保持、备份与问卷日期保留。
- 独立浏览器会话使用合成资料，通过首次填写与跳过、修改摘要与档位、刷新、目标编辑、部分重填归档、查看来源、JSON 导出/校验/恢复。
- 390px 手机与桌面界面已截图检查，无横向溢出。
- 一次真实聊天 HTTP 200，发送了 3 项相关合成画像及独立目标并收到实际模型回复；未验证真实用户长期效果或真实账户跨设备云端恢复。
- 审查发现的问卷日期丢失已修复；没有提交、推送、部署或新增依赖。

## 主要改动文件

- 契约与规则：`src/types/cognitive.ts`、`src/lib/profile/questionnaire.ts`、`evidence.ts`、`store.ts`、`client.ts`、`usable.ts`、`context.ts`、`overview.ts`、`extract.ts`。
- 模型与目标：`src/lib/goals/store.ts`、`client.ts`；`src/lib/chat/context.ts`、`actions.ts`；`src/lib/ai/chat.ts`、`suggestions.ts`；`src/lib/profile/reflection.ts`、`reflection-api.ts`、`adaptation.ts`。
- 页面与组件：`src/app/onboarding/page.tsx`、`questionnaire.css`、`layout.tsx`；`src/components/app-shell.tsx`；`src/features/profile/trait-questionnaire.tsx`、`trait-level-control.tsx`、`profile-overview.tsx`、`profile-record-info.tsx`、`goal-editor.tsx`、`profile-review-panel.tsx`、`memory-update-review.tsx`、`profile-response-adaptation.tsx`；`src/features/chat/chat-workspace.tsx`、`chat-context-panel.tsx`、`chat-suggestion-card.tsx`。
- 验证与说明：`tests/trait-questionnaire.test.ts`、`chat-suggestion-actions.test.ts`、`profile-overview.test.ts`、`profile-usable.test.ts`、`tests/fixtures/semantic-retrieval-cases.ts`；README、AGENTS、产品方向与本轮实现计划。
