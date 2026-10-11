# 给 Cursor 的知衡项目接手说明

更新日期：2026 年 10 月 11 日。安目前同时使用 Codex 和 Cursor 协助开发。

**本次任务是先阅读并理解项目，向安反馈你的理解；暂不修改代码、安装依赖或调用付费模型。** 后续开发以安分配的具体任务为准。本文件根据当前工作区文档、目录、共享类型和 npm scripts 整理，没有重新验收全部功能。

## 1. 项目是什么

项目名是 **知衡（Zhiheng / Personal Cognitive AI）**，由澳门城市大学学生为参加 2026 年第十一届「粤港澳大湾区 IT 应用系统开发大赛」澳门区分赛开发。工作区文件夹叫 `second me`，不能据此认为项目已经接入 Second Me 平台。

当前由安负责开发、UI、比赛 PPT 和 Demo；姚、曹的新任务暂停，保留已有贡献。安是计算机科学专业低年级本科生，需要结构清楚、小步实现、适合初学者理解的解释。

截至 10 月 11 日，产品主线是：

**可选初始问卷 → 日常聊天 → 有来源的五项行为画像 → 用户核对当前状态 → 用户独立设定目标 → 后续聊天提供相关帮助。**

五项行为是：**行动力、规划与拆解、时间安排、复盘调整、探索尝试**，主要关注学习和项目中的做事方式。

- 初始问卷可以跳过；答案、摘要和当前档位经用户核对后才保存。
- 聊天中 AI 提出的画像先是候选，用户确认后才成为可用的当前画像。
- 当前自评、目标档位、改变意愿、AI 帮助程度是不同信息，分别保存。
- 不确定、不适用和跳题不能当作低档；档位不表示人格分数、能力或事实置信度。
- 旧七维记录和目标保留为其他背景与旧资料，不自动转换成五项新档位。
- 旧“三视角决策”方案及 `/history`、`/goals`、`/decision` 页面属于历史参考。

## 2. 阅读顺序

1. [AGENTS.md](../AGENTS.md)：开发约定、当前责任、AI 与数据边界。
2. [README.md](../README.md)：当前能力、配置、Windows 运行和检查命令。
3. [产品方向](product-vision.md)：重点看开头的 10 月 11 日范围调整；后文七维及旧分工有历史内容。
4. [项目背景与比赛要求](project-context.md)：了解用途、比赛来源和时间安排；其中旧七维功能描述需结合当前代码核对。
5. [五项画像与问卷](trait-questionnaire.md)、[背景与记忆摘要](personal-context-memory-summary.md)：当前主线的行为、来源与兼容规则。
6. 按需阅读 [AI 操作建议](ai-action-suggestions.md)、[错误与存储改进记录](code-quality-errors-storage.md)及 `docs/superpowers/plans/` 中对应任务的记录。

文档有日期和历史段落。当前产品范围按安最新确认的要求及 `AGENTS.md`、产品方向开头理解；代码是否实现、是否通过验收需要分别核对。若发现冲突，指出文件与具体内容，不自行重新定义产品。旧计划不是新的开发任务。

## 3. 现有结构和入口

技术栈按当前 `package.json`：Next.js 16.3.6、React 19.3.0、TypeScript 5.9.3，要求 Node.js 24 或以上。主要业务资料保存在浏览器，真实 AI 调用走服务端；可选账户和手动快照使用 Supabase。

```text
src/
  app/                       页面、CSS、服务端 API 路由
    chat/                    主入口
    onboarding/              可跳过的初始问卷
    profile/                 当前画像、来源、目标、背景、摘要
    progress/                行动与结果记录
    backup/                  本地 JSON 备份恢复
    account/                 可选邮箱账户与手动云端快照
    api/                     聊天、画像整理、摘要等接口
  features/                  页面对应的界面组件
  components/                应用外壳、侧栏等共享组件
  lib/
    chat/                    聊天存储、请求、上下文、操作建议
    profile/                 画像、来源、问卷、审核与相关性选择
    goals/                   独立目标与改变意愿
    preferences/             回答偏好、自由背景与回答要求
    ai/                      服务端模型调用
    storage/                 本地存储基础入口
    backup/                  本地 JSON 校验与恢复
    cloud/                   可选云端账户与快照
    outcomes/                行动记录
    retrieval/               默认关闭的本地语义检索实验
  types/                     共享类型
tests/                       自动测试
scripts/                     检索评估与模型准备脚本
database/schema.sql          现有云端结构记录
docs/                        产品、比赛及开发记录
```

先沿着一条流程阅读，不需要第一轮读完所有文件：

| 要理解什么 | 先看哪些文件 |
| --- | --- |
| 页面与聊天界面 | `src/app/page.tsx`、`src/app/chat/page.tsx`、`src/features/chat/chat-workspace.tsx` |
| 回复怎么产生 | `src/lib/chat/api.ts` → `src/app/api/chat/route.ts` → `src/lib/ai/chat.ts` |
| 个人资料怎么参与聊天 | `src/lib/chat/context.ts`、`src/lib/profile/context.ts`、`src/lib/profile/usable.ts` |
| 当前画像、候选、目标的区别 | `src/types/cognitive.ts`、`src/types/chat-api.ts` |
| 问卷怎么保存 | `src/features/profile/trait-questionnaire.tsx`、`src/lib/profile/questionnaire.ts` |
| 画像和目标怎么展示 | `src/features/profile/profile-overview.tsx`、`src/features/profile/goal-editor.tsx` |
| 自由背景和摘要 | `src/lib/preferences/store.ts`、`src/features/profile/personal-context-panel.tsx`、`src/lib/profile/summary.ts` |

`src/types/cognitive.ts` 同时保留五项新维度和七项旧分类，这是兼容现有资料的设计。`src/types/domain.ts` 是旧演示类型，新功能不要直接套用其中的 `DecisionCase`、`BehaviorPattern`。

## 4. 已有入口与实际限制

以下是当前资料与代码入口的概览，不是本轮重新实测的结果：

- `/chat` 保存本地对话并请求服务端模型；缺少 Key 或失败时明确报错并允许重试。画像整理可以手动触发，也可由用户开启按新发言触发，结果始终待审核。
- `/onboarding` 和 `/profile` 已有五项行为问卷、当前自评及独立目标入口。问卷保留题目、答案、日期和版本，不能伪装成聊天证据。
- 自由背景与回答要求通过 `src/lib/preferences` 保存；开启后作为用户资料参与聊天，不覆盖系统规则，也不自动创建目标。修改快捷偏好与自由设置时需互相保留。
- 记忆摘要按需归纳有效确认记录，带来源；来源变化后隐藏旧摘要。摘要是临时展示，不保存成新的事实。
- AI 操作建议只提出目标、记忆归档或行动记录草稿；点击后打开表单，用户再次确认才保存。
- `/progress` 有本地行动和自评记录，尚未形成自动更新画像的完整反馈闭环。
- `/backup` 有本地 JSON 恢复；`/account` 有可选邮箱账户和手动云端快照。日常资料未按云端账户完整隔离，不能写成实时同步或完整跨设备工作副本。
- 本地语义检索是默认关闭的实验，仍有漏选和误选；不能称为已验证的精准检索或完整 RAG。
- 公开 production 环境 AI 接口当前关闭。`build` 成功不代表生产页面能调用真实 AI；公开服务的账户隔离和防滥用仍待完成。

## 5. Codex 与 Cursor 协作约定

不要假定你已了解安与 Codex 的全部对话。以安本次提供的任务和实际工作区为依据，先检查 `git status --short` 与任务相关的 diff。

- 当前工作区已有大量修改和未跟踪文件；这些可能来自安或另一工具，不因未提交就可以删除或覆盖。
- 安分配开发任务后，先说明目标、允许修改的文件、输入输出和验收方法，再小步修改；理解项目这一步不授权主动开发新功能。
- 两个工具处理不同任务时，应明确文件范围；若任务要改动另一工具正在修改的同一文件，先指出重叠，等安明确协调方式后继续该部分。
- 不擅自执行 `git reset --hard`、`git clean`、批量重写、提交、推送、合并或部署。后续具体操作以安的授权为准。
- 复用现有业务模块、共享类型、模型客户端和存储格式，不另建第二套数据入口。页面组件不直接操作 `localStorage`。
- 不为统一风格做大规模重构。新增 dependency（依赖）须说明必要性、作用和 Windows 安装命令；npm、锁文件、环境变量、数据库迁移由安统一协调。
- Key 仅放服务端环境变量，不加 `NEXT_PUBLIC_`，不进入浏览器包、日志或仓库；不输出 `.env.local` 中的密钥。
- 保留来源、审核状态、修改和删除能力；用户文字不能覆盖系统规则。不要让模型获得执行命令、改文件或向他人发送消息的工具。
- 写 Next.js 代码前阅读已安装版本的 `node_modules/next/dist/docs/` 中相关指南，不能直接套用旧版本经验。

## 6. 后续需要运行时的 Windows 命令

第一轮只读了解项目，无需主动安装或启动。之后安安排运行或修改任务时，在项目根目录使用 PowerShell：

```powershell
# 首次获取项目、依赖尚未安装时
npm.cmd ci

# 本地开发
npm.cmd run dev -- --port 3001
```

打开终端显示的地址并进入 `/chat`，通常是 `http://127.0.0.1:3001/chat`。如果已有开发服务，先确认地址，避免重复启动。

真实 AI 需要 `.env.local` 中的服务端 `LLM_API_KEY`，默认 `LLM_MODEL` 为 `deepseek-flash`。已有配置不要用模板覆盖；仅首次配置且文件不存在时使用：

```powershell
if (-not (Test-Path -LiteralPath '.env.local')) {
    Copy-Item -LiteralPath '.env.example' -Destination '.env.local'
}
```

由安在本地填入 Key，变更后重启服务。不要在聊天中要求粘贴密钥。云端和语义实验有独立准备要求，见 README；不要重复执行 `database/schema.sql`。

后续代码修改按影响范围执行检查，完整检查入口为：

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

测试、类型检查和构建不能代替真实模型、账户回调、备份恢复及界面操作验收。没有运行的检查明确写“未执行”；历史记录的测试数量不能写成本轮结果。

## 7. 比赛时间边界

比赛简报与路演使用同一份 PPT，要求 10–15 页，可选视频 2–5 分钟。邀请函原定报名和首次作品提交截止是 10 月 1 日。

安另外确认：14 日前完成最终核对与提交准备，15 日前更新并提交 PPT，15 日后不再修改，24 日使用最终版；20 日冻结演示功能。不要把后续 PPT 安排写成报名延期，也不要安排 15 日后修改路演 PPT。具体截止时刻、更新渠道、评分权重和单队时长需按通知核实，不编造。材料只写已验证能力，规划明确标注。

## 8. Cursor 第一轮需要回复什么

读完后，用中文向安反馈：

1. 用自己的话说明项目的当前目标和用户主流程。
2. 说明页面、业务模块、共享类型、浏览器存储、服务端模型之间的关系，并列出关键文件。
3. 区分现有代码入口、历史资料、未验证能力及未来规划；指出发现的文档或代码冲突及依据。
4. 说明后续与 Codex 协作时如何避免文件覆盖，并列出真正影响下一项开发的待确认问题；没有就写暂无。

**完成这次阅读后等待安分配具体任务，不自行启动重构、补齐旧计划或更改产品方向。** 后续每次修改都需报告修改文件、原因、Windows 运行方式、实际验证、限制及下一步建议，解释以低年级本科生能理解为准。
