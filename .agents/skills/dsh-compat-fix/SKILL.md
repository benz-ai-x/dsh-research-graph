---
name: dsh-compat-fix
description: DeepSeek Harness 升级后对本插件（dsh-research-graph）做兼容性适配的完整流程：契约差异分析、代码适配、四级验证、PR 与发布。当用户说 harness 升级/适配/兼容性修复时由用户手动调用。
whenToUse: 用户指出 DeepSeek Harness 出了新版本、要求适配新版 DSH、修复升级后的兼容性问题，或要求发布适配版本时
disable-model-invocation: true
---

# DSH 兼容性适配与发布

目标：让插件跟上官方 DSH 新版本，**功能行为不变**，通过全部验证门禁后按用户指令发布。先读根 `HANDOFF.md`（当前基线、Harness 路径、未竟事项）和 `AGENTS.md`（行为不变式、发布政策），再动手。

## 0. 前置确认

- 从 HANDOFF.md「当前目录与启动」表读取匹配 Harness checkout 路径（当前为 `/Users/pc2026/DSH-Space/deepseek-harness`）；在该目录确认新版本 tag（`git fetch --tags && git tag -l 'dsh-v*' | tail`）并检出，工作树保持干净，只构建不改源码。
- 插件当前兼容目标 = `package.json` 中**精确的** `@deepseek-ai/dsh-llm` peer 依赖，不许从版本号截断猜测。
- 版本政策：新 DSH 线首次适配，插件取**完整目标版本**（如 `0.1.7-rc.1`）；同一 DSH 预发布的后续修订追加正整数（`0.1.7-rc.1.1`）。所有直接 `@deepseek-ai/dsh-*` 依赖钉到目标版本。
- 新包发布未满 24 小时时，一切 pnpm 命令带 `pnpm_config_minimum_release_age=0`（pnpm 11.7 的运行前校验不读 `minimumReleaseAgeExclude`；`pnpm install` 会自动把新版本的精确豁免追加到 `pnpm-workspace.yaml`）。
- GitHub API 直连超时就用 `https_proxy=http://127.0.0.1:8888 gh ...`（本机 8888 代理，已确认）；git over SSH 不受影响。

## 1. 契约差异分析

在 Harness checkout 对两个 tag 做差异分析（`git log 旧tag..新tag --oneline`、`git diff 旧tag 新tag --stat`），重点核对插件实际依赖的面。已知敏感面（逐版本重新核对，不凭此清单默认无变化）：

- `dsh-llm` 消息模型（`MessageSourceMap` / `createUserMessage` / `BlockAssembler`）
- Session Controller 客户端列表状态与刷新方法（`SessionListState` / `refreshProjections` / `subagentCatalog`）
- `useSessionStatus`、`SessionSummary`、`ctx.uiWorkspace.openSession`、`SubagentAddress`
- Typert codec（`{ mode: 'strict', create: () => schema }`）、Remote 命名空间
- Session 格式目录（`sessionFormatCatalog` / `historicalSessionFormatCatalog` / `createSessionFormatCatalogWithChildren`）与 `sessionProjectionCache` 签名
- locale/configForms 等注入服务名、Conversation 视图标准挂钩
- `cordis.patch.yml` wiring 与 profile 启动期的插件 peer 版本强制校验

对每处记录「变了/没变/不确定 + 文件:行号」。破坏性变化逐条定位插件改动点（`grep` 全仓含 `types/`、`tests/`、`scripts/`）。

**契约面必须从插件的实际依赖推导，不能只凭上面的经验清单**（清单会过时）：列出 `package.json` 的 `dsh.client.inject` 与全仓 `from '@deepseek-ai/...'` 导入，对涉及的每个上游包逐一核对 diff；`types/` 里的独立适配声明和 `tests/fixtures/`（含 `profile-smoke.mjs`）也是契约面的一部分。静态 diff 必然有漏网——0.1.7 适配时 inject 服务改名、新视图挂钩、缓存签名三处都是测试阶段才暴露的。

## 2. 适配修改

- 先 bump：`package.json` 版本与全部直接 DSH 依赖、精确 peer；`pnpm install` 更新锁文件。
- 修编译错误（`pnpm run typecheck`），再修行为；同步 `types/deepseek-harness.d.ts`、`types/context.d.ts` 独立适配声明与全部测试 fixture。
- 消息来源等持久格式改动必须同时考虑**旧日志兼容**：projection/迁移工具要同时接受新旧信封形态（参考 0.1.7：`dsh-session-graph` / `plugin:dsh-session-graph` / 旧 `plugin` 三种）。
- 持久化格式变化（Session 格式版本、存储域 schema、投影状态）必须前置回答：**用户现有 profile 的升级路径是什么**？插件工具没有的证据（如 V3→V4 的子会话事实）不能自己编，交给 Host 启动迁移路径，并写清工具产物停在哪个代际。
- 离线恢复工具 `scripts/migrate-merge-history.mjs` 保持自包含、可在 Host 首次启动前运行；V2→V3 分类器只认 `plugin` 信封，写入形态不能随意改。
- 不改写未跟踪的研究资料（`docs/research/`、`docs/reports/`、`architecture.svg` 不入库）。

## 3. 验证阶梯（逐级通过，缺级不算完成）

1. `pnpm run check`（独立套件；发布验证用 `RELEASE_TAG=v<版本> pnpm run check`）
2. 确认 Harness checkout 已构建（`build:native-system`、`build:lib`，冒烟还需 `build:web`），然后 `DSH_HARNESS_ROOT=<checkout> pnpm check:harness`（四个编译面 + 完整 Harness 套件）。换 tag 后先核对构建产物新于 tag 提交时间，避免拿旧构建当新契约。**首轮 check:harness 失败是正常的契约发现环节**：失败日志就是上游真实契约，逐条修，不为赶绿而改测试语义。
3. `pnpm pack --pack-destination .artifacts` 后 `DSH_HARNESS_ROOT=... pnpm smoke:harness`（实包隔离 profile：安装/离线恢复/研究读写/移除，固定模型 19 次）
4. `pnpm preview:dsh` 起隔离预览，真实浏览器打开样例讨论切到「研图」，核对徽标 `Research Graph v<版本> · <Build ID>` 与图谱渲染；改动若触及画布/布局/连线，另按 AGENTS.md 补两种范围 × 宽窄窗口的几何验收。用完 `pnpm preview:dsh --stop`

## 4. PR 与合并

- 分支 `feat/dsh-<目标版本>`（或 `fix/...`），Conventional Commit；PR 正文写清用户可见影响、上游破坏性变化清单、验证证据。排除未跟踪研究资料。
- 盯 CI 四项（Node 22.19/24/26 + Matching DSH release）；失败先拉日志定位，修好再推。**Matching DSH release 的实包冒烟是最后一道网**——本地全绿不代表 CI 绿（0.1.7 首轮就因 smoke fixture 按旧信封断言而失败），把它当流程内事件而非意外。
- **合并必须等用户明确指令**；合并用普通 merge，合并后核对合并树与已验收 head 的 tree 一致，根 main 快进同步，看合并后 main CI。

## 5. 发布（仅在用户明确说 release 后）

1. 预检：`npm view` 确认候选版本不存在、远端无同名 tag、main 与 origin 同步。
2. 发布准备 PR（`release/<版本>`）：双语 README 与 `docs/user-guide*.md` 的版本表/安装命令/适配说明，新增 `docs/reviews/release-<版本>.md`（结构沿用上一版，含验收边界）；`RELEASE_TAG` 检查通过；四项 CI 绿；用户确认后合并并核对 tree。
3. `git tag -a v<版本>` 指向合并提交并推送；`gh release create --prerelease` 触发 OIDC 发布。
4. 正式包回验（与候选分开，不混用哈希）：一律以 `registry.npmjs.org` 为准查询 integrity/shasum（本机默认 registry 是 npmmirror 镜像）；发布后 npm 有分钟级传播延迟，404 时稍等重试，不要用代理的缓存负面响应当证据。SLSA provenance 核对仓库/tag/publish.yml/运行 ID 与归档摘要，官方字节再跑一次隔离冒烟，Release 挂归档 + SHA256SUMS 并下载回读，验收记录补正式数值。
5. 更新 `docs/reviews/release-<版本>.md` 与根 HANDOFF.md 并推送；徽章读取 `package.json`，不在源码里写第二处版本号。

## 红线

- 测试红、验证缺级、版本政策不符时不宣称完成；合并与发布必须用户明确指令。
- HANDOFF.md 是唯一实时交接，原地更新；`docs/HANDOFF.md` 是历史快照。
- 凭证、token、预览 URL 不进 GitHub 与公开文档。

## 模式沉淀

每轮适配结束后，把**可复用的上游契约模式**追加到这里（只收跨版本反复出现或 likely 重现的，一次性的版本细节进 HANDOFF/验收记录）：

- 上游自有 kind 一律用 `declare module '@deepseek-ai/dsh-llm' { interface MessageSourceMap }` 合并声明， provenance 字符串沿用 `dsh-session-graph`（0.1.7 起）。
- 客户端读取子代理/标题等派生数据走 `refreshProjections` + `list.getSnapshot().projectionsBySession[id].values.<key>`，不读已删除的专用列表字段（0.1.7 起）。
- 测试 bench 里上游注入服务改名（如 `settingsScope`→`configForms`）会让 locale 插件静默不加载、视图不注册——症状是"插件 tab 不出现"，先查 inject 链。
