# Browser Use 本地聊天集成

更新日期：2026 年 10 月 13 日。本文说明当前代码、启动方式、实际验证与限制；设计依据见[集成规格](superpowers/specs/2026-10-12-browser-agent-integration.md)。

## 当前功能

`/chat` 默认正常聊天。用户主动选择“网页查找”后，知衡按本次任务与选中的个人资料制定有限搜索计划，启动独立浏览器查找公开学习资料，核对候选后生成适合原因及限制。当前最终最多推荐 3 个资源，并展示网页原文和访问时间。

这条流程复用原有聊天、画像、目标、偏好、模型调用和备份，不另建个人资料数据库。结果作为普通助手消息保存，附带现有“本次参考资料”记录；网页候选不会自动变成个人事实或用户目标。

## 项目入口与请求流程

```text
/chat 主动选择网页查找
  → 本地筛选有效确认记忆、启用目标与已启用设置
  → Next.js /api/agent/tasks：现有模型生成有限计划
  → Python FastAPI 127.0.0.1:8001：单任务 Browser Use 执行
  → Next.js 轮询：真实动作、访问 URL、已核对候选
  → Next.js /api/agent/tasks/<id>/result：现有模型整理结果
  → 原聊天 Store 保存助手回复与参考记录
```

| 文件或目录 | 作用 |
| --- | --- |
| `src/features/chat/chat-workspace.tsx` | 发送模式、选中资料、取消、重试与原聊天保存 |
| `src/features/chat/agent-task-card.tsx`、`src/app/agent.css` | 临时执行状态、搜索计划与真实访问记录 |
| `src/lib/agent/context.ts` | 复用原资料筛选并补充有限的学习资料偏好规则 |
| `src/lib/agent/model.ts` | 请求校验、计划生成、候选整理与回复格式 |
| `src/lib/agent/api.ts`、`server.ts`、`protocol.ts` | 客户端轮询、私有服务通信、共享校验 |
| `src/types/agent.ts`、`src/app/api/agent/tasks/` | 集成类型与 Next.js 路由 |
| `browser-agent/app.py`、`jobs.py`、`schemas.py` | FastAPI 鉴权、单任务管理及结构校验 |
| `browser-agent/runner.py`、`browser_policy.py`、`public_urls.py`、`validation.py` | 浏览执行、公开地址及下载限制与实际页面核对 |
| `browser-agent/probe.py` | 已验证模型适配、浏览器路径与项目内运行目录；保留独立探针 |
| `scripts/start-browser-agent.ps1`、`browser-agent/requirements.lock` | Windows 服务启动与锁定 Python 依赖安装 |

规划与最终整理使用已有 `requestModelCompletion`，没有建立第二套 Next.js 模型客户端。Python 复用现有官方 `ChatDeepSeek` 继承适配，对 `deepseek-flash` 明确关闭 thinking；该兼容处理依赖 Browser Use `0.13.11`。

## 个人资料的使用范围

1. 只使用本次用户任务，不发送整段聊天历史。资料来源经过既有 `usableProfileInsights` 过滤，只选择已确认且来源仍有效的记忆；最多 5 条，并保留所选原话。
2. 用户目标与当前事实分开；最多 2 项与任务相关的启用目标，暂停目标不参与。没有相关资料时按一般公开资料任务执行，不补满数量。
3. 复用原 3000 字符记忆、目标及快捷偏好 JSON 预算。自由填写的背景与回答要求沿用独立字段上限（分别 3000 字、2000 字），因此 3000 字符不是整个请求的总长度。
4. 启用的个人背景、自由回答要求及快捷偏好可参与规划和整理。沿用当次明确排除规则，例如“不要参考个人记忆”“不要参考我的背景”；背景排除与回答要求分别处理。资料查找另外用有限词项匹配已确认的语言、资料形式和学习基础，不从五项行为档位推断知识或英语水平。
5. Next.js 模型收到本次任务与上述选中资料。Python 服务收到任务、请求编号和有限计划，不收到完整记忆对象、目标对象、个人背景正文或聊天备份；筛选条件可能包含本次必要的学习背景，因此不是匿名数据保证。
6. 模型提示要求搜索词不包含姓名、联系方式或私密经历，不把完整背景拼进搜索框；这依赖模型正确执行及用户任务内容，不等于已完成通用隐私脱敏。网页内容与用户资料均作为数据，不能覆盖系统规则。

网页查找成功后不触发普通聊天的自动记忆整理与操作建议检测。若用户之后要保存新记忆或修改目标，仍需走原审核、确认流程。

## Windows 启动方式

Node.js 使用项目现有 24 版本环境。Python 安装与虚拟环境保持在 D 盘；本机已有 `D:\python\python.exe`，版本 3.13.7。首次获取项目先按根目录 README 安装 npm 依赖；已有 `.env.local` 时保留它，不能用模板覆盖。

从项目根目录打开两个 PowerShell 终端。

```powershell
# 终端一：已有 Python 环境，启动执行服务
.\scripts\start-browser-agent.ps1
```

新机器首次启动改用：

```powershell
.\scripts\start-browser-agent.ps1 -Install -PythonPath 'D:\python\python.exe'
```

`-Install` 在 `browser-agent/.venv/` 创建虚拟环境（若尚不存在），从 `requirements.lock` 安装固定版本的 Python 包，包括 Browser Use `0.13.11`、FastAPI `0.143.0` 和 Uvicorn `0.54.0`。没有新增 npm 依赖，不自动安装或搬移系统浏览器。

```powershell
# 终端二：首次获取项目时，在环境脚本之后先执行 npm.cmd ci
. .\scripts\use-project-node.ps1
npm.cmd run dev -- --port 3001
```

打开 `http://127.0.0.1:3001/chat`，选择“网页查找”。任务最多 2000 字；使用公开或合成任务验证。

两端复用根目录 `.env.local` 的 `LLM_API_KEY`、`LLM_MODEL`，无需新 API Key。缺少配置会明确失败。修改模型配置后重启两个服务。真实 AI 与 Agent 接口在 production 环境关闭，`npm.cmd run build` 用于构建检查，实测使用 `npm.cmd run dev`。

Next.js 默认连接 `http://127.0.0.1:8001`。`BROWSER_AGENT_URL` 是可选、仅服务端读取的本机 HTTP 地址，示例已注释在 `.env.example`；换端口时同时调整 Python `-Port` 与该地址，再重启 Next.js。浏览器程序位于其他路径时，在 Python 服务终端设置实际存在的 `$env:BROWSER_AGENT_BROWSER_PATH`。

服务首次启动自动生成 `output/browser-agent/service-token.txt`，Next.js 在服务端私下读取，用 `X-Agent-Token` 调用 Python。无需复制令牌到环境变量、前端或手工请求，也不加入 Git。FastAPI 只监听 `127.0.0.1`，没有 CORS，禁用公开 API 文档；Next.js 路由沿用本机同源及 production 限制。

## 搜索、页面与结果限制

计划包含一个 `objective`、1–3 条 `queries`、1–6 条 `criteria`，分别限制长度；无效模型输出不启动浏览器。唯一搜索入口是程序注册的 `search_bing`，第一条搜索由程序执行，后续搜索由 Agent 从这个受控动作发起。

2026-10-13 经安确认，取消最初五个资料站名单，改为通过 Bing 搜索并浏览不同网站的公开 HTTPS 学习资料，包括文档、课程介绍、教材、文章、论文介绍和开源项目，优先可信原始来源。任务仍是学习资料检索，不扩展账号和表单操作。当前读取 HTML 页面，不保证能读取完整课程、播放视频或验证每个资源条件；视频介绍页可访问不等于视频内容已核实。验证码、登录要求、网络或模型动作失败可能导致无结果。

Next.js 和 Python 同步过滤非 HTTPS、带账号密码、非标准端口、IP 地址、单标签主机及本地域后缀。Python 对直接导航先检查 DNS，非公网、混合公网/私网或无法解析的地址拒绝；公开网页 watchdog 在导航事件及新标签中复查，观测和候选还经过 URL 校验。只允许内部 `about:blank` 用于启动和清理，不把它作为候选。这是本地原型的导航与结果约束，不是浏览器网络沙箱：未拦截所有子资源请求，也不保证阻止所有重定向与 DNS 重绑定；完整漏洞审查仍另行安排。

执行不登录、注册、支付、上传、提交表单、下载文件或运行命令。模型的输入、上传、文件读写、任意脚本执行和保存 PDF 等动作已移除；运行器仍自行进行只读 CDP 页面观察并写诊断文件，模型不获得这类操作控制权。

`browser_policy.py` 针对锁定的 0.13.11 使用公开 `BaseWatchdog.detach_handler_from_session` 移除自动下载 watchdog，并以 CDP `Browser.setDownloadBehavior` 禁止下载，同时关闭下载接收和 PDF 自动下载。真实本地附件验证观察到下载状态为取消、保存文件为零。该实现不能直接假定适用于上游升级，版本变化后须重跑策略测试和真实下载验证。

候选最多 5 条、最终整理最多 3 条。返回前逐条核对：

- URL 必须出现在本次浏览器实际观察中；Bing 搜索页不作为资源。
- 标题直接取网页 `document.title`，不由模型生成。
- 摘录为 10–300 字符的短连续原文；只允许空白与引号排版差异，匹配后复制网页实际文字，不接受翻译、改写或拼接片段。
- 最终整理只允许引用已核对候选的原样 URL，不能额外生成链接；回复包括适合原因、未满足或未核实条件、原文及访问时间。

链接和摘录核对证明候选来自本次访问，不能证明模型每一句结论、资源质量或学习效果。没有可核对候选时返回失败，不用合成结果代替真实浏览。

## 进度、取消与失败恢复

页面展示规划、浏览、整理、停止、完成、失败或取消状态。实际访问记录来自浏览器观察的 URL、标题和动作；不展示内部思考或模拟百分比。

| 状态 | 当前行为与操作 |
| --- | --- |
| 服务未启动或连接失败 | 明确提示先启动本地服务；用户任务消息保留，可重新查找 |
| 模型配置缺失或计划无效 | 不伪造计划；检查根目录配置、重启服务后重试 |
| 无已核对资源、网页受阻或浏览失败 | 不生成成功回复；调整任务或稍后重新查找 |
| 结果整理失败 | 候选保留，点击“重新整理已获取结果”只重试整理，不重复浏览 |
| 已完成任务不存在（`NOT_FOUND`） | 清除旧恢复状态，允许重新查找；常见于服务重启或历史清理 |
| 已有任务执行中 | 单任务槽拒绝另一任务；等待或先停止当前任务 |
| 用户停止 | 取消模型等待或浏览执行，等待浏览器清理；消息保留，可调整后重新发送 |
| 浏览器关闭未确认 | 服务阻止新任务，提示重启执行服务后再试 |

浏览最多 15 步、执行时限 240 秒，另有最多 20 秒的浏览器清理预算；规划和最终整理是额外模型请求，不承诺整条流程 240 秒内完成。浏览器关闭使用受保护的清理任务，取消不能直接跳过清理。取消请求等待停止后才确认任务终止；规划期间的取消留下短期标记，避免迟到计划继续启动浏览器。

相同请求编号不会重复执行；把它用于不同任务会拒绝。Python 同时只管理一个在途任务，不使用数据库或队列。历史在内存中最多保留 20 项、约 30 分钟，过期数据在后续创建时清理，服务重启即失去这些状态。

UI 进度只在当前页面内存中保留，刷新后不恢复任务面板或自动接续。页面 `pagehide` 或路由卸载会尽力发送取消，但浏览器关闭、网络中断等情况下不保证送达；服务端执行时限仍会终止任务。已成功保存的助手消息和参考记录刷新后可查看，并进入现有 JSON 备份。

## 本机文件与数据

Python 虚拟环境在项目 `browser-agent/.venv/`；pip 缓存、临时文件和执行数据放在 D 盘项目 `output/`。系统 Chrome/Edge 程序可位于原安装目录，但执行使用独立 `browser-profile`，不连接日常浏览器或读取已有登录状态。关闭 Browser Use 匿名遥测和云端同步；访问网页与模型本身仍需网络。

`output/browser-agent/service-runs/<requestId>/` 保存独立浏览器资料目录、框架运行文件和有限执行报告。`result.json` 包含计划、动作、观察页面 metadata、候选和校验失败；不保存完整个人资料或完整页面正文，但拒绝项可能包含短页面片段。任务历史的内存清理不等于自动删除磁盘诊断目录；这些内容留在本机忽略目录，不上传仓库。

上游源码副本位于本机 `output/vendor/browser-use/`，用于查阅，不修改上游。MIT 版权声明保留在 [public/licenses/browser-use.txt](../public/licenses/browser-use.txt)。运行详情及历史探针证据见 [browser-agent/README.md](../browser-agent/README.md)。

## 验证状态与复查方法

**初次集成验证（2026-10-13）：** 340 项 TypeScript/Node 测试、18 项 Python 测试、`pip check`、类型检查、lint 和 production 构建通过。放宽网页范围后的回归为 343 项 TypeScript/Node 测试、21 项 Python 测试、`pip check`、类型检查、lint 和 production 构建通过；日志为 `expanded-ts-tests.log`、`expanded-python-tests.log`、`expanded-build.log`。构建通过不启用公开 AI 接口；真实使用仍通过 `npm.cmd run dev`。

- 放宽后的真实任务 `aa681db3-cb0d-42fb-a79d-0df2d01a32f1` 使用无个人资料的公开 MDN 中文 JavaScript 学习请求：现有模型制定计划，Browser Use 通过 Bing 搜索并实际打开 MDN，核对 2 个候选，Next.js 最终整理返回 1 个推荐。该轮经真实 API 验证新网站的完整返回链路，未另做新的个人画像对照或比赛录屏。原始记录为 `output/browser-agent/expanded-web-job.json`、`expanded-web-summary.json` 和该任务 `service-runs/<编号>/result.json`。
- 最新导航前检查通过真实独立浏览器验证：直接导航本机 IP 被拒绝，MDN 中文指南成功打开，记录为 `expanded-live-policy.json`。此独立脚本退出时出现 Windows asyncio 管道回收警告，进程退出码为 0；不把它作为所有浏览器生命周期无缺陷的证明。

- 使用项目现有 Store 生成并通过现有 `/backup` 界面恢复合成资料：1 条有完整原话来源的确认记忆、1 项启用目标和已启用背景。真实聊天请求显示并传递了这三类资料；Browser Use 访问 Python 官方中文教程，核对了 3 个候选，Next.js 完成整理并保存回复和参考记录。刷新后回复、原文、访问时间以及“1 条记忆 · 1 项目标”仍可核对。
- 核对当前数量与表达规则：同一批已验证候选再次经真实结果接口整理，请求“一份”返回 1 项；措辞区分用户希望/偏好与已发生事实。此步骤复用了候选，没有重新执行浏览器。
- 真实界面“停止查找”后显示已取消，服务恢复空闲，项目执行浏览器残留数为 0；规划期间取消与清理期间取消的竞态另由专项测试覆盖。
- 真实本地附件测试确实发起了下载请求，CDP 报告取消，保存文件数为 0。17 项后扩展到当前 18 项 Python 测试也覆盖了下载监听器关闭、清理失败阻止新任务、幂等、过期和鉴权。
- 普通 `/api/chat` 的真实无个人资料短请求成功；桌面及 390×844 手机视口检查未见本轮新增横向溢出，浏览器控制台无错误。
- 服务重启/过期后的重新查找分支与整理失败保留候选的行为有代码和自动测试核对，没有把所有网络故障或所有支持站点都列为真实验收通过。

原始运行与验证记录在本机忽略目录 `output/browser-agent/`，最终完整任务编号为 `4e5e524f-5b20-4b88-b7d4-67ac2250fe4d`；对应 `service-runs/<编号>/result.json`、`final-ui-task.json`、`final-summary.json`、`final-ts-tests.log`、`final-python-tests.log` 和 `build.log`。UI 检查图在 `output/playwright/`，这些是开发验证记录，不是本轮新增的比赛录屏或对比 Demo。

已观察的真实流程与最终回归检查分别记录：

- 已有合成、已启用背景的真实 `/chat` 网页查找经过计划、浏览、核对、整理，并把一条 Python 官方资源保存成聊天回复。回复明确说明中文及“10 分钟”条件不满足或未核实，没有假装完全满足。
- 已有真实本地附件下载测试观察到取消、保存文件为零。这只核对当前下载策略，不代表完整浏览器安全审计。
- 2026 年 10 月 12 日独立 `browse` 和 `search` 探针成功是历史执行层证据，具体次数、耗时及记录路径保留在 `browser-agent/README.md`，不能替代当前聊天集成验收。

代码复查命令（不会主动执行真实模型或云端账户操作）：

```powershell
Push-Location .\browser-agent
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
Pop-Location
.\browser-agent\.venv\Scripts\python.exe -m pip check
. .\scripts\use-project-node.ps1
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

真实 UI 复查在两个服务启动后进行；使用合成资料，并记录实际结果：

1. 普通聊天发一条短任务，核对原有模型回复和本地保存。
2. 在“网页查找”请求公开资料，核对计划、真实 URL、页面标题、连续原文和访问时间；不足条件应说明，不补造资源。
3. 使用合成启用背景、有效确认记忆及启用目标，核对本次资料数量；暂停、删除、来源失效或当次排除后再查，核对被排除资料不进入参考。
4. 检索中停止，确认任务取消后可发新任务；规划中停止，确认迟到计划不会启动浏览器。
5. 验证服务未启动、网络受阻和整理失败提示；整理失败重试应复用候选。服务重启后的旧任务应允许重新查找。
6. 成功回复后刷新，核对助手消息和参考记录；进度面板不恢复。下载并检查 JSON 备份仍使用现有格式，不新增 Agent 存储区。

上述是复查步骤，未执行的项目不能写成通过。production AI/Agent 禁用、站点覆盖、长期效果与云端账户隔离需分别看待，不能用构建成功代替真实流程验收。

## 后续范围

对比 Demo、录屏、PPT、云端账户隔离、持久任务与通用 Agent 留待单独安排。当前先保证用户主动触发、参考范围可核对、真实候选可溯源、失败可重试、取消可清理，不由本次集成扩展其他项目模块。
