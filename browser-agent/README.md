# Browser Use 本地执行服务与探针

本目录提供知衡 `/chat` 的本地“网页查找”执行层：Next.js 使用现有模型入口制定计划，Python 用官方 Browser Use 浏览公开资料，Next.js 再按本次相关个人资料整理已核对候选。默认普通聊天，用户主动选择“网页查找”才执行。集成与数据边界见[完整记录](../docs/browser-agent-integration.md)。

独立探针保留用于检查模型、浏览器与网络。个人资料对比 Demo、录屏和 PPT 不在本轮范围；当前服务也不提供通用 Agent、云端持久任务或完整账户隔离。

## 来源与运行环境

- 上游：<https://github.com/browser-use/browser-use>，使用官方发布版 `0.13.11`。
- MIT 许可证和版权声明保留在 [Browser Use 许可证](../public/licenses/browser-use.txt)。
- 官方源码副本在本机忽略目录 `../output/vendor/browser-use/`，用于查阅，不修改上游源码。
- Windows Python 环境：本目录 `.venv/`，本机使用 `D:\python\python.exe`（3.13.7）。
- Python 依赖完整固定在 [requirements.lock](requirements.lock)：Browser Use `0.13.11`、FastAPI `0.143.0`、Uvicorn `0.54.0`。启动脚本首次安装使用该锁文件，没有新增 npm 依赖。
- 复用项目根目录 `.env.local` 的 `LLM_API_KEY`、`LLM_MODEL`，Python 通过官方 `ChatDeepSeek` 适配执行；不需要第二个 API Key。规划与最终整理复用知衡 `requestModelCompletion`。
- 官方 0.13.11 适配仅对 `deepseek-v4` 名称发送 thinking 配置，遗漏当前 `deepseek-flash` 别名。现有继承适配补上别名，明确关闭 thinking；不修改上游或现有知衡聊天配置。该适配依赖锁定版本，升级时需重跑兼容测试。
- 使用系统已安装 Chrome 或 Edge 的程序文件，建立独立的临时资料目录，不连接日常浏览器或使用已有登录信息。
- 缓存、临时文件、运行日志、结果与浏览器资料目录都放在项目 D 盘 `output/`；关闭上游匿名遥测和云端同步。允许调用已安装的系统浏览器程序，不搬移或修改它。
- 模型请求会产生 API 用量。聊天集成把本次任务和选中资料发送给模型；Python 获得任务与有限计划，不获得完整聊天、画像或备份。独立探针只发送其公开测试任务与网页内容。

## 启动聊天集成（Windows PowerShell）

在项目根目录打开两个终端，不需要手动激活 Python 虚拟环境：

```powershell
# 终端一：已有 browser-agent/.venv 时启动
.\scripts\start-browser-agent.ps1

# 新机器首次安装并启动；Python 应已安装在 D 盘
.\scripts\start-browser-agent.ps1 -Install -PythonPath 'D:\python\python.exe'
```

两条命令按机器准备状态选择一条。`-Install` 创建本目录 `.venv/`（若尚不存在），并安装 `requirements.lock`。已有环境直接启动；两种方式都不会覆盖根目录 `.env.local`。

```powershell
# 终端二：首次获取项目，先执行 npm.cmd ci
. .\scripts\use-project-node.ps1
npm.cmd run dev -- --port 3001
```

打开 `http://127.0.0.1:3001/chat`，选择“网页查找”并发送不超过 2000 字的公开资料任务。页面展示真实搜索计划、访问记录和停止操作；最终回复包含链接、适合原因、限制、网页原文和访问时间。没有符合所有条件的资料时如实说明，不填满资源数量。

FastAPI 默认只监听 `127.0.0.1:8001`，单进程、一次执行一个浏览器任务。服务自动创建 `output/browser-agent/service-token.txt`，Next.js 只在服务端读取并用于鉴权；无需手填新秘密，不要把该文件加入 Git。Python 不开放 CORS，浏览器页面通过 Next.js 的同源接口访问。真实 AI 与 Agent 接口在 production 环境仍关闭，应使用 `npm.cmd run dev` 实测。

可选服务地址只由 Next.js 服务端读取，默认无需设置。若端口 8001 被占用：

```powershell
# 终端一
.\scripts\start-browser-agent.ps1 -Port 8002
```

然后在已有 `.env.local` 中添加 `BROWSER_AGENT_URL=http://127.0.0.1:8002` 并重启 Next.js。地址仅允许本机 HTTP，不配置公开服务器。缺少模型密钥时，只在现有根目录 `.env.local` 配置 `LLM_API_KEY`；不要覆盖已有配置或把密钥写入本目录代码。

如果 Chrome/Edge 在其他目录，可在启动 Python 服务的终端设置实际存在的程序路径：

```powershell
$env:BROWSER_AGENT_BROWSER_PATH = 'D:\你的浏览器目录\chrome.exe'
```

脚本不自动安装或搬移系统浏览器。

## 浏览范围、结果与停止规则

- 唯一搜索动作是受控 `search_bing`；可打开不同网站的公开 HTTPS 学习资料 HTML 页面，不再限定最初五个资料站。文档、课程介绍、教材、文章、论文介绍和开源项目均可作为候选，优先可信原始来源。可访问视频介绍页不等于能播放或核实整个视频内容；遇到登录、验证码或网络限制可能失败。
- `public_urls.py` 和 Next.js 协议校验过滤非 HTTPS、账号密码、非标准端口、IP 地址、单标签主机与本地域后缀。浏览器直接导航前检查 DNS，拒绝解析到非公网地址的域名；watchdog 在导航事件和新标签中复查。该策略不是网络沙箱，不保证拦截所有页面子请求、重定向或 DNS 重绑定；公开部署或账号操作仍需另行设计和审查。
- 不登录、注册、支付、上传、提交表单、执行命令或下载。移除输入、文件读写、任意脚本执行等模型动作；运行器自己的只读页面观察与诊断文件写入不交给模型控制。
- `browser_policy.py` 使用 Browser Use 0.13.11 的公开 watchdog detach helper 移除自动下载处理，并通过 CDP 禁止下载。真实本地附件测试观察到下载取消、保存文件为零；此策略依赖锁定版本，升级后需重新核对。
- 最多 15 步、浏览执行最多 240 秒，另有最多 20 秒的浏览器关闭预算；规划与结果整理是独立模型请求，这不是整个任务的总耗时承诺。
- 候选最多 5 条、最终最多 3 条。每条 URL 必须实际访问过，标题取浏览器 `document.title`；连续原文摘录只容许空白与引号排版差异，核对后复制网页实际文字。摘录核对不等于完整结论已做事实验证。
- “停止查找”需等浏览器清理后释放任务槽。清理在取消期间受保护；关闭未确认会阻止新任务，并提示重启执行服务。
- 规划阶段取消会留下短期取消标记，阻止迟到计划继续创建任务。同一请求编号不会重复执行；重复编号用于另一任务会拒绝。
- 结果整理失败保留已获取候选，可点“重新整理已获取结果”，只重试模型整理。服务重启或任务不存在时清除旧恢复状态，可重新查找。
- UI 进度仅临时保留，刷新后不恢复；页面关闭或离开路由会尽力发送取消，但不保证请求送达，服务端执行时限仍生效。任务历史只在服务内存中保留，最多 20 项、约 30 分钟，并在后续创建时清理。
- 最终助手消息及现有参考记录通过原聊天 Store 保存并进入 JSON 备份。网页结果不会自动创建、确认或修改个人记忆和目标，也不触发普通聊天的自动记忆整理与操作建议检测。

服务每次执行写入 `output/browser-agent/service-runs/<requestId>/result.json`，记录有限计划、动作、页面 metadata、候选及校验失败；不保存完整背景或页面正文，但诊断拒绝项可能含短页面片段。`output/` 中仍可能出现任务条件和网页内容，不加入 Git。

## 独立探针（保留的排错入口）

从项目根目录执行，不需要启动 Next.js 或 FastAPI：

```powershell
# 当前机器安装已完成后，直接运行
.\scripts\run-browser-probe.ps1

# 在可见的独立浏览器窗口中运行
.\scripts\run-browser-probe.ps1 -Visible

# 搜索并打开官方 GitHub 仓库
.\scripts\run-browser-probe.ps1 -Mode search -Visible
```

换一台 Windows 机器时，在 D 盘安装 Python；要安装并测试独立探针可运行：

```powershell
.\scripts\run-browser-probe.ps1 -Install -PythonPath 'D:\python\python.exe'
```

默认探针浏览模式访问 `example.com`；搜索模式使用 Bing，并打开 `browser-use/browser-use` 官方仓库。探针保留原测试域名限制，独立于现已放宽的聊天服务。上面的 `-Visible` 仅是独立探针参数，聊天服务使用 headless 模式。

## 验证命令与状态

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

独立探针每次运行生成 `output/browser-agent/runs/<时间>/result.json`，包括实际访问页面、浏览器读取的标题/正文、动作名、模型结果、耗时和失败信息。
原始记录不进入 Git。只有框架报告成功、结果通过结构校验、链接确实访问过、标题与摘录能在实际页面中核对且浏览器正常清理，才返回成功退出码。
标题直接取自本次浏览器读取的 `document.title`，模型只负责提取摘录和整理回答，不生成页面标题。
网页摘录校验不等于整段模型结论已得到事实验证。

独立探针默认最多 8 步、总执行时限 180 秒，另有最多 20 秒的浏览器清理时限。聊天服务使用上面说明的 15 步／240 秒限制。浏览器执行失败不返回合成答案。
搜索引擎验证码、GitHub 网络连接、模型动作格式仍可能导致失败；访问测试成功不代表任意任务都可完成。

当前集成已通过合成的确认记忆、启用目标与背景完成真实 `/chat` 查找，获得 Python 官方中文候选、整理并保存回复和参考记录，刷新后仍保留；再次整理已核对候选时，“一份”的简单数量要求返回 1 项。放宽范围后，真实访问 MDN 中文站、核对 2 个候选，并通过 Next.js 结果接口返回 1 个推荐。真实停止查找后服务恢复空闲、无残留执行浏览器；本地附件请求被取消且未保存文件。**本轮 343 项 Node/TypeScript 测试、21 项 Python 测试通过**；不以此宣称所有网站或推荐结论都已验收。实际范围与原始记录见[集成记录](../docs/browser-agent-integration.md)。

## 历史探针实测（2026-10-12）

- 官方源码 tag `0.13.11`，对应 commit `914c59bdd4acd50e9628a97a96a3919313aebc85`；安装的 PyPI 包为 0.13.11。
- 使用现有 DeepSeek Flash 配置，未改动根目录 `.env.local`。
- `browse`：真实读取公开页面，3 条历史步骤，18.62 秒，结果链接/标题/摘录校验及浏览器清理通过。
- `search`：真实执行 Bing 搜索、滚动、打开 GitHub 仓库并提取 README，6 条历史步骤，46.07 秒，结果校验及清理通过。
- 浏览记录：`output/browser-agent/runs/20261012T150553825440Z/result.json`。
- 搜索记录：`output/browser-agent/runs/20261012T150637992489Z/result.json`。
- 5 项 Python 测试、`pip check`、PowerShell 语法检查和既有知衡 326 项测试通过。
- 实测使用 headless 模式（无可见窗口的真实浏览器）；可见窗口入口已提供，本轮没有重复验证该模式。

这两次历史成功只验证当时的独立执行层，不代表任意网站稳定性，也不作为本轮聊天集成的最终测试结果。当前 Python API 与前端集成范围见本文前半部分；对比 Demo、录屏、PPT、云端账户隔离、持久任务与通用 Agent 仍待单独安排。
