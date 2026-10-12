# 2026-10-12 工作区与 GitHub 整理

安授权整理当前工作区并同步开发成果。保留既有改动和原提交历史，不扩展产品功能，不改写正式比赛材料，不合并 main 或部署。

## 文件与分支

- 原始改动文件快照、整理前 Git 状态和可恢复的 Git bundle 保存在本机忽略的 `private-data/workspace-cleanup/2026-10-12/`。
- 五份根目录比赛原文件完整移动到 `private-data/contest-materials/2026-10-12/`。逐文件 SHA-256 校验一致，清单保存在该目录的 `manifest.json`。来源和截图隐私尚待核对，原件不上传。历史原因见[材料核对清单](contest-materials-review-2026-10-11.md)。
- `output/` 保留有用途的 D 盘 Node、npm 缓存、语义模型、浏览器验收截图及研究源码，并全部忽略。`node_modules/`、`.next/` 是可再生成的依赖/构建产物，不提交。
- `.env.local`、本地浏览器数据和快照不提交。环境模板仍只跟踪 `.env.example`。
- 当前开发成果使用 `codex/chat-profile-ready`，从原 `feat/project-foundation` 本地 HEAD 建立，保留之前八个本地提交。原分支与旧 Draft PR #1 不被强制覆盖、删除或合并。
- GitHub 仓库为公开仓库。代码、测试、依赖锁文件、开源许可与开发文档通过新的 Draft PR 待审查；main 保持原有状态。

## 本次整理的内容

- 保留米白、浅绿、深绿 UI，整理现有按钮、问卷、面板、菜单及目标表单反馈改动。
- 纳入逐回复参考资料的保存、旧数据兼容、来源失效隐藏与 11 项测试。详情见[参考资料记录](chat-reply-references.md)。
- 纳入 `scripts/use-project-node.ps1`，运行文件、npm 缓存和临时目录使用项目内 D 盘路径。
- Lucide 的锁定依赖与 `public/licenses/lucide.txt` 一同保存；许可内容与已安装包 LICENSE 校验一致。
- 用 `npm ci` 按最终锁文件重新安装，避免沿版本范围漂移；保留现有 API、数据结构和模型服务。
- TypeScript 排除 `output/`、`private-data/`、`.cache/` 和 `.playwright-cli/`，防止本地备份及调研源码进入编译。

## 验证范围

独立只读审查未发现当前代码与依赖改动的新增阻断问题。自动私有密钥检查覆盖当前待提交文件及八个未推送提交中的文本版本，未发现已配置私有密钥或所检查的典型 token/private-key 模式；该检查不等于全面安全认证。

最终本地验证结果和 GitHub 同步结果在本文件末尾记录。原有浏览器界面验收保留其日期；本轮没有重新验证真实用户长期效果、完整云端恢复、公开 AI 服务或现场比赛条件。

本轮最终工作区：292 项测试通过，typecheck、lint、Next.js 16.3.8 production 构建通过。`npm audit --omit=dev` 报告 0 项告警；完整依赖审计的剩余开发工具告警见下节。五份材料原件已与整理前备份逐一核对 SHA-256。

## 依赖核对与剩余告警

本轮将 Next.js 与 eslint-config-next 从 16.3.6 更新为兼容补丁 16.3.8，将 source-map-js 更新为 1.2.2，然后执行 `npm ci --no-audit` 恢复最终锁文件对应的依赖。没有新增业务库、降级框架或使用 `npm audit fix --force`。

最终完整 `npm audit` 仍报告 5 项 high：`braces` 及其开发工具链上的 `micromatch`、`fast-glob`、`@next/eslint-plugin-next`、`eslint-config-next`。这是一个基础告警沿依赖链产生的多个包记录，不能解释为五个独立漏洞。[上游公告](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)当前标注没有修复版本；保留为明确限制，不声称安全问题全部解决。具体 JSON 报告只留在忽略的 `output/workspace-cleanup/`。

`npm ls` 的两个 extraneous 项实际仍在锁文件中标记为 optional：`@img/sharp-wasm32` 与其 `@emnapi/runtime`。干净的 `npm ci` 也会产生它们；为保持锁文件可复现，本轮不手工修改安装器内部目录。当前 Windows 原生 sharp 包另有锁定记录。ESLint 9.39.5 有上游支持期结束提示，按既有 React/Next 插件兼容约定保留，后续需专项验证升级。

## 运行

```powershell
. .\scripts\use-project-node.ps1
npm.cmd ci
npm.cmd run dev -- --port 3001
```

打开终端显示的地址，主入口 `/chat`。已有 `.env.local` 时保留原配置，不使用模板覆盖；AI 密钥只放服务端环境变量。

检查命令：`npm.cmd test`、`npm.cmd run typecheck`、`npm.cmd run lint`、`npm.cmd run build`。语义实验保持默认关闭，模型文件不随 Git 上传；按 README 单独准备。
