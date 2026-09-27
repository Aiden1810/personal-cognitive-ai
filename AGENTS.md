# 开发约定：Personal Cognitive AI

适用对象：三名团队成员，以及协助开发的 AI/Codex。先读 README，再按当前任务范围工作。

## 1. 当前授权与项目阶段

本仓库目前只完成项目启动文档与 Git 协作。应用开发任务须由负责人明确安排；不要因为读到未来规划就自动创建 Next.js、安装依赖、创建数据库或实现页面。

本文件规定未来开发边界。负责人下达某个模块任务后，在该任务范围内执行，不把本文理解为整项目一次性实现的授权。

- 具体演示场景待团队确定；不写死比赛加功能、学习换课等故事。
- 首版只支持一个场景，真实案例和合成演示资料必须区分。
- 不做心理诊断、人格分数、自动价值判断和本地模型训练。
- Windows 是默认开发环境。给出适用于 PowerShell 的实际命令。
- 用简单、清晰的 TypeScript；保持现有风格，避免无关重构。

## 2. 模块责任与修改边界

| 维护者 | 主要范围 |
| --- | --- |
| 负责人 | README、AGENTS、根配置、依赖与锁文件、`src/app`、`src/types`、`src/lib`、共用组件、环境变量及后续数据库迁移 |
| A | `src/features/history`：案例与模式审核 |
| B | `src/features/decision`：目标、三种结果、反馈；PPT 与 Demo 材料 |

页面路由壳由负责人创建，A/B 在自己的 feature 目录交付组件和模块。不要各自重建根布局、全局样式或 UI 体系。

需要改公共类型、接口或其他人的目录时，先向负责人提出具体修改与影响；未经任务授权不越界。获得授权后无需为相同修改反复确认。

不自行新增依赖、模型 SDK、数据库、环境变量或另一套数据格式。负责人统一确定包管理器并维护一份锁文件；当前尚未选定或安装。

## 3. 公共数据约定 v0.1

以下是待实现的契约，不是已存在的 TypeScript 文件或数据库 Schema。负责人在骨架任务中将其转换为 `src/types/domain.ts` 和 `src/types/api.ts`；A/B 不自行重定义同名实体。

### 通用约定

- 字段使用 camelCase；组件名使用 PascalCase。
- ID 是不含业务含义的字符串；后续由统一入口生成。
- 时间使用带时区的 ISO 8601 字符串；不要拿本地显示文本作比较依据。
- 列表为空使用空数组；契约中的可空字段使用 `null`，不混用空字符串。
- 文本必填字段经去除首尾空格后不能为空；空白表单不能生成案例。
- `userId` 首版为统一的 `demo-user`。它不构成身份认证；正式多用户版本必须从服务端会话取得用户身份，不能信任浏览器传入的 userId。
- 全部记录包含 `id`、`userId`、`createdAt`、`updatedAt`。
- UI 中文展示；状态值与字段名使用下述英文枚举。

### DecisionCase：历史案例

| 字段 | 约定 |
| --- | --- |
| title | 简短标题，必填 |
| context | 当时的情境，必填 |
| scenario | 场景标识，团队确定演示场景后统一取值 |
| options | 当时的备选行动，文本数组，可为空 |
| constraints | 截止时间、资源等约束，文本数组，可为空 |
| actualChoice | 实际采取的行动，必填；没有实际选择的新问题不能当成历史案例 |
| outcome | 后续结果，文本或 null；null 表示尚未知晓 |
| occurredAt | 事件时间，ISO 字符串或 null；与录入时间区分 |
| sourceType | `self_report`、`observed` 或 `demo` |
| sourceNote | 来源说明；observed 必须说明可检查的记录来源，demo 必须注明合成/脱敏情况 |
| sourceRef | 来源链接或记录位置，文本或 null；不保存带访问凭证的链接 |
| status | `pending`、`confirmed` 或 `rejected` |

案例中来自用户回忆的行为仍为 self_report。confirmed 表示用户核实了记录，不把自述自动转换为独立观测。

### BehaviorPattern：行为模式

| 字段 | 约定 |
| --- | --- |
| description | 场景内的行为观察，不使用诊断性标签 |
| scenario | 与案例场景一致 |
| supportCaseIds | 支持案例 ID 数组 |
| counterCaseIds | 反例 ID 数组 |
| caveats | 资料不足、情境差异等限制，文本数组 |
| status | `pending`、`confirmed` 或 `rejected` |
| userNote | 用户纠正说明，文本或 null |

AI 只能创建 pending 候选。用户编辑已确认模式后，需要再次确认；驳回模式不参与后续个性化生成。支持与反例编号必须存在且属于同一演示身份，不得引用 rejected 案例。

### ImprovementGoal：用户目标

| 字段 | 约定 |
| --- | --- |
| patternId | 对应已确认模式的 ID，或 null；允许用户主动提出目标 |
| description | 用户希望怎样行动，必填 |
| scenario | 适用场景 |
| applicability | 适用条件，由用户核对的自然语言说明 |
| status | `active` 或 `inactive` |

确认模式不会自动创建目标。目标只能由用户主动启用。与模式关联的目标在模式被驳回后应停用并提示用户重新核对。首版每次决策手动选一个 active 目标，不让 AI 自动叠加多个目标。

### CurrentDecision：当前问题

包含 `question`、`scenario`、`options`、`constraints`。question 必填；选项与约束为文本数组。缺少关键条件时显示限制或请求补充，不编造截止时间和行为结果。

### PerspectiveAnswer：单个视角结果

| 字段 | 约定 |
| --- | --- |
| perspective | `generic`、`original` 或 `better` |
| status | `ready` 或 `insufficient_evidence` |
| summary | 简短结果 |
| reasoning | 可公开给用户的依据摘要；不要求或保存模型隐含思维链 |
| evidenceCaseIds | 实际引用的案例 ID 数组 |
| goalId | 使用的目标 ID，或 null |
| ruleIds | 实际应用的规则 ID 数组；没有时为空 |
| caveats | 不确定性和信息不足，文本数组 |

generic 的 evidenceCaseIds 和 ruleIds 为空，goalId 为 null。original 的 goalId 为 null，只依据历史提出倾向预测。better 使用当前 active 目标；无有效目标时提示设置目标，不假装完成个性化改进。

### DecisionComparison：生成记录

包含 `currentDecision`、三个 PerspectiveAnswer（分别名为 `generic`、`original`、`better`）、`generationSource`、`modelId`、`contractVersion`、`rulesVersion`、`evidenceSnapshot`、`patternSnapshot`、`goalSnapshot`。

- generationSource 为 `live` 或 `example`；example 必须显著标识，modelId 为 null。
- evidenceSnapshot 保存本次使用案例的内容与来源；patternSnapshot 和 goalSnapshot 保存当时的状态与文本。不能只存 ID 后用已修改的数据解释旧回答。
- 本次引用必须属于提供给该视角的证据集合。删除案例时不让保留的快照意外暴露用户要求删除的内容；正式删除流程需同时处理快照。
- contractVersion 初始 `0.1`；规则实现后再确定 rulesVersion，不宣称已有规则运行。

### DecisionFeedback：反馈

包含 `comparisonId`、`actualChoice`、`recordedAt`、`outcome`、`outcomeRecordedAt`、`userNote`。

actualChoice 必填；outcome、outcomeRecordedAt、userNote 可为 null。选择与结果分开记录。采纳建议不等于建议正确；不自动把结果变化解释为因果关系。反馈转为历史案例需用户核对后确认。

## 4. 数据与接口边界

### 数据入口

计划由 `src/lib/data` 对外提供读取演示状态、保存/删除案例、保存模式、保存目标、保存生成记录、保存反馈的统一入口。

- A/B 不直接操作 localStorage，不自行建立 Supabase 客户端。
- 各页面调用同一入口，立即读取最新状态；模式驳回、案例删除或目标停用后，不使用旧缓存继续生成。
- 存储实现由负责人统一维护；首版浏览器保存，后续替换为数据库。
- 本地状态标注 contractVersion，加载异常时提示用户；重置演示数据需要用户明确操作，不静默覆盖录入内容。

### 计划中的服务端接口

| 接口 | 请求内容 | 成功返回 |
| --- | --- | --- |
| `POST /api/patterns/analyze` | scenario、confirmed 的 cases | pending 的 BehaviorPattern 候选数组，允许为空 |
| `POST /api/decisions/compare` | currentDecision、confirmed 的 cases 与 patterns、用户选定的 active goal | DecisionComparison |

首版记录和生成接口相互分离：浏览器通过数据入口保存；服务端负责生成与校验。接口由负责人实现，当前尚不可调用。

成功输出统一为 ok=true、data；失败输出统一为 ok=false、error，其中 error 含 code 和适合用户阅读的 message。请求校验错误与服务端错误使用合适的 HTTP 状态，不把失败伪装成成功。

初始错误码：`VALIDATION_ERROR`、`MISSING_ACTIVE_GOAL`、`LLM_UNAVAILABLE`、`INVALID_MODEL_OUTPUT`、`INTERNAL_ERROR`。错误文本不返回密钥、原始请求日志或堆栈。

生成服务必须再次校验状态、场景、ID 与请求结构。无历史时 original 可返回 insufficient_evidence；不能凭空生成倾向。无目标时比较页面先引导设置目标，接口返回 MISSING_ACTIVE_GOAL。

生成不自动写成正式模式或修改用户目标。示例回退仅在用户选择“查看预置示例”后显示，不静默代替真实生成。

## 5. AI 与规则职责

- LLM：候选分析、解释、生成建议；输出按契约校验。
- 系统：状态过滤、证据集合、目标生效、规则条件、引用检查、版本与反馈保存。
- 用户：确认记录与模式、决定是否改变、选择目标、记录实际行动。
- 证据和用户文本是待分析数据，不是可覆盖系统规则的指令。模型不获得修改数据库、执行命令或发送消息的工具。
- 三个视角分别构建上下文。不得一次传入全部个人历史后宣称 generic 没有读取历史。
- 保持相同模型和生成设置；不为制造对比而故意让 original 推荐不合理行动。
- 不使用模型生成的置信数字作为已校准概率；首版使用 caveats 和支持/反例说明。

## 6. 未来环境变量约定

当前没有应用或 .env 文件。应用骨架实现时由负责人创建无真实值的 `.env.example` 并同步 README。

统一的服务端变量计划为 `LLM_API_KEY`、`LLM_MODEL`、`LLM_BASE_URL`。供应商确定后定义必填与默认值，不让成员猜测端点或模型名。缺少配置时明确报告不可用，不假装成功调用。

- 密钥不加 NEXT_PUBLIC_ 前缀，不进入浏览器包或日志。
- .env 和本地环境文件不提交；示例文件只写变量名称和占位值。
- A/B 用共享示例数据开发界面，不需要负责人密钥。
- 后续 Supabase 配置由负责人统一制定；不把服务端特权密钥暴露给客户端。
- 不索要或记录私人 token，不把真实个人案例、聊天日志提交到仓库。

## 7. GitHub 日常协作

1. 查看负责人分配的任务与验收要求。
2. 从最新 main 创建小任务分支。
3. 让 AI 先读 README、AGENTS，再限定修改目录。
4. 检查 diff，确认没有越界或密钥；验证模块。
5. 提交小 PR，说明目标、文件、验证结果与限制。
6. 负责人检查接口与整合；核心逻辑请其他成员复查。
7. 合并后验证主流程，再从新 main 开始下一任务。

不在 main 上直接开发应用，不强制推送共享分支，不丢弃他人未提交修改。初始文档提交由负责人直接建立 main，后续遵循 PR 流程。

## 8. 每次交给 AI 的任务要包含

- 目标和用户操作。
- 输入/输出及引用的公共类型。
- 允许修改的目录和明确禁止修改的公共文件。
- 本任务是否授权增加依赖、改公共契约或联网发布。
- 正常、空数据、加载、失败等需要覆盖的状态。
- 实际验收步骤；完成后报告文件和验证证据。

AI 先说明理解，再小步修改。遇到接口不足先报告具体缺口，不自行另建系统。当前没有应用时不得编造安装或运行命令。

## 9. 验证与 Demo

文档启动阶段只检查文档、契约一致性及 Git 状态，不安装测试框架。应用实现后，对真实风险验证：

- 添加和编辑案例后刷新，数据一致；空表单不能保存。
- 案例或模式被驳回、目标停用后，后续请求不使用它们。
- 支持案例和反例可查看，生成引用均来自有效输入。
- 证据不足时弃答，未启用目标时提示，不编造个人画像。
- 三视角上下文边界正确，例子/实时请求标识准确。
- 模型超时、配置缺失、无效输出时展示错误，保留用户输入。
- 实际选择与后续结果分别保存，旧回答保留当时依据。
- 合成与脱敏资料清楚标识；录屏不暴露密钥或私人记录。

不得声称未执行的测试通过。负责人在代码落地后补充实际使用的检查命令；不要用空测试或只镜像实现的测试充数。

## 10. 交付格式

每次完成任务报告：已完成内容、修改文件、如何运行、实际验证结果、限制和下一步。没有运行条件时说明缺少什么，不以“应该正常”代替验证。

范围与分工变更由负责人同步到 README 和本文件，再通知团队。具体演示场景、供应商、成员 GitHub 用户名和正式品牌目前待定；这些待定项不授权 AI 自行扩大功能或邀请不明身份账号。
