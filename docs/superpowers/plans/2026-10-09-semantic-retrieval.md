# 知衡：本地语义检索实验（2026-10-09）

本轮按安的“直接开始做、继续”授权执行。目标是验证师兄提出的核心问题：同一句需求换一种说法后，能否找到有用的已确认记忆。保留现有聊天、用户审核、独立目标与浏览器存储，不重写产品、不加入人格标签、向量数据库或模型微调。

## 已完成

- 安装并固定 `@huggingface/transformers@4.3.1`；CPU 运行公开多语言 MiniLM 的 q8 权重，输出 384 维向量。
- `npm.cmd run prepare:semantic` 显式下载约 135 MB 公开文件至 `.cache/semantic-model/2c4055b/`；模型目录已忽略，不上传 Git。权重 SHA-256 校验，已有权重校验不通过会报错，不覆盖。
- 推理仅加载本地文件，禁止模型网络请求，不读取密钥、全部原始聊天或原话旁支，不缓存个人文本。聊天回答本身仍由现有 DeepSeek 接口处理。
- 同一次请求计算问题、已确认且有来源的画像描述、启用目标的向量，使用余弦相似度，与关键词分数混合排序。相似度不是画像置信度；审核与证据资格仍优先。
- 每次最多处理 100 条描述/目标、合计 20000 字符；单条最多 1200 字符。编码最多 128 tokens，长文本可能截断，不能描述成“完整编码所有文字”。
- 输出仍最多 5 条画像、2 项目标，按同一 JSON 预算最多 3000 字符，保留所选完整原话，不裁掉原话限定条件。
- `/chat` 新增默认关闭的“尝试关键词＋语义检索（实验）”。仅本页有效，刷新恢复关键词方式；参考面板显示实际方式、语义关联及失败回退提示。6500ms 内未取得完整有效结果就使用关键词方式，聊天仍可继续。
- 新增仅本机开发可调用的 `/api/retrieval/semantic`；生产环境禁用，跨来源拒绝，请求校验先于模型加载。错误响应不包含原始文本、密钥或本地路径。
- 修复“不需要画像”缺少参考动词时失效的问题；已知课程规则新增数据库/操作系统，防止以“课程”共同词召回错科目。规则只覆盖明确表达和有限科目，目标仍独立筛选。

## 对照与验证

独立设计 15 个合成、人工标注案例，在调参前固定。初始关键词 5/15，初始混合 8/15；修复上述两处共同规则后，**关键词 7/15、混合 10/15**。阈值保留 0.55，没有降低阈值去补齐全部已知案例。这是开发评估集，不是盲测或真实用户准确率。详细漏选/误选和相似度见 `output/semantic-retrieval/evaluation.json`，可用 `npm.cmd run evaluate:semantic` 重跑。

混合仍失败的案例：临近截止的改写、独自调试与求助的改写、同时召回取舍和推进方式、当前否定与仅润色需求、长文章摘要的改写。当前否定案例还多选了一条笔记偏好；不能因此宣称“精准检索”或自动理解当前情绪。

- 新行为测试先观察缺失语义召回、缺失请求流程及两处规则错误，再实现修复；最后完整 **170 项测试**通过，类型、lint、生产构建通过。
- 原 22 个固定检索案例及 12 个挑战案例通过；它们检验默认规则方式，不代表全部语义模型效果。
- 独立审查发现并修复：混合排序缺分记录保留原始分值、压过已归一化语义记录；Transformers.js 4.3.1 pipeline 不传 `max_length`，通过真实 tokenizer 配置实现 128-token 上限。修复前合成长文本403 tokens，修复后128。
- 本机阻断 `fetch` 后实际 embedding 推理仍得到 2×384 向量，联网调用为0；不是完整操作系统断网/不同设备验收。
- 浏览器新建两段合成演示：先提取并确认“面对观众发言时紧张，脑中内容消失”的一次经历，再在新对话问“答辩前焦虑，担心现场脑袋空白”。真实请求通过语义关联只附加这一条画像和原话，收到 DeepSeek 回复；原有资料保留。刷新后实验关闭、对话保留、浏览器错误日志为空。
- 截图：`output/contest-2026-10-09/semantic-retrieval-proof.jpg`。截图证明实际请求附带资料，不证明模型一定正确采纳或改善效果。

## 文件和运行

- `src/lib/retrieval/`：模型配置、离线计算、输入校验和相似度、实验请求与混合评分。
- `src/lib/chat/{api,context}.ts`：接入可选实验，沿用审核、目标、去重和预算；`src/lib/profile/relevance.ts`：科目规则。
- `src/features/chat/{chat-workspace,chat-context-panel}.tsx`、`src/app/product.css`：开关与真实参考展示。
- `src/app/api/retrieval/semantic/route.ts`：本机 Node 服务。
- `scripts/{prepare-semantic-model,evaluate-semantic-retrieval}.ts`、新增5个测试文件、`tests/fixtures/semantic-retrieval-cases.ts`：准备、对照与回归验证。
- `package.json`、锁文件、`.gitignore`、README及比赛能力文档：依赖、命令与当前边界。

```powershell
npm.cmd ci
npm.cmd run prepare:semantic
npm.cmd run evaluate:semantic
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run dev -- --port 3010
```

本机模型已准备，重复命令校验并跳过已有文件。其他设备需要首次网络下载，模型未准备时普通聊天仍使用默认规则。场内实时聊天沿用开发服务和同一浏览器端口；`start` 的生产 AI 路由仍关闭。

## 后续优先级

1. 解决当前明确否定、仅要求润色时旧状态误入的问题；用更多独立合成案例检查误选，不只提高召回率。多意图检索和阈值校准仍待研究。
2. 对同一基础模型做有/无已确认个人资料的实际对照，准备可复现的演示与备用录屏。
3. 10月11–13日更新现有14页比赛 PPT，14日核对、15日前提交；15日后不再改，24日使用同一份。实验如写入必须同时标注默认关闭及效果边界。

没有自动冲突检测、证据自动合并、时间衰减、稳定情绪识别、持久化向量索引、完整 RAG 系统或个人模型训练。PPT 本轮未修改或提交，代码未推送、合并、部署。

安装后的 npm audit 提示7项高等级依赖报告，涉及现有 Next.js / ESLint 依赖链和 source-map-js，不涉及新增 Transformers 依赖链。没有自动 `audit fix --force`；安排独立的小版本维护验证，避免为消除报告把 Next ESLint 降到旧主版本。

官方依据：[Transformers.js 4.3.1 源码](https://github.com/huggingface/transformers.js/tree/4.3.1)、[固定模型文件](https://huggingface.co/Xenova/paraphrase-multilingual-MiniLM-L12-v2/tree/2c4055b)。实际 API 另以安装包源码与本机运行核对。
