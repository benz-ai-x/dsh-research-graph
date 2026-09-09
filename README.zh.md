---
description: "DeepSeek Harness（dsh）AI Agent 会话可视化与管理插件：在交互式图谱画布中浏览会话谱系、排列分支、汇聚快照并生成摘要。"
kind: "package-bundle"
---

# Session Graph：DeepSeek Harness 会话可视化插件

[![CI](https://github.com/benz-ai-x/dsh-session-graph/actions/workflows/ci.yml/badge.svg)](https://github.com/benz-ai-x/dsh-session-graph/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40benz-ai-x%2Fdsh-client-ui-session-graph?logo=npm)](https://www.npmjs.com/package/@benz-ai-x/dsh-client-ui-session-graph)
[![dsh-plugin](https://img.shields.io/badge/DeepSeek_Harness-dsh--plugin-4D6BFE)](https://github.com/topics/dsh-plugin)
[![GitHub release](https://img.shields.io/github/v/release/benz-ai-x/dsh-session-graph?logo=github)](https://github.com/benz-ai-x/dsh-session-graph/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[English](README.md) | 中文

**面向 DeepSeek Harness（dsh）的 AI Agent 会话可视化与管理插件。**

Session Graph（`@benz-ai-x/dsh-client-ui-session-graph`）为 DeepSeek Harness Web 对话视图添加交互式 **Graph** 标签。在同一画布中浏览 Session Lineage（会话谱系）、跳转对话、创建 Branch（分支）、汇聚会话快照，并生成 Session Digest（会话摘要）。

Branch 连接的 Canvas Session 组成可移动会话簇，Merge Session 保留快照溯源，Subagent Session 折叠为紧凑摘要。按需生成的 Session Digest 帮助回顾关键结论与待办。浏览、排列与生成摘要都不会修改 Session 日志。

<p align="center">
  <a href="docs/assets/session-graph-overview.png">
    <img src="https://raw.githubusercontent.com/benz-ai-x/dsh-session-graph/main/docs/assets/session-graph-overview.png" alt="DeepSeek Harness Session Graph，展示分支、汇聚关系、子代理摘要、标题过滤和画布控制" width="100%" />
  </a>
</p>

<p align="center"><sub>使用合成演示会话渲染的真实 Session Graph 界面。</sub></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@benz-ai-x/dsh-client-ui-session-graph">npm</a> ·
  <a href="https://github.com/benz-ai-x/dsh-session-graph/releases">版本发布</a> ·
  <a href="https://github.com/benz-ai-x/dsh-session-graph/issues">问题反馈</a> ·
  <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a>
</p>

## 快速开始

```sh
dsh plugin --profile web add @benz-ai-x/dsh-client-ui-session-graph@0.1.5-alpha.1
dsh web
```

若 `dsh web` 已在运行，请先停止再重启。打开命令打印的一次性认证 URL，进入任意非空 Session，然后选择 **Graph**。不要分享或持久保存 URL 中的 token。

## 兼容性

| Session Graph | DeepSeek Harness | Node.js | 验证方式 |
|---|---|---|---|
| [`v0.1.5-alpha.1`](https://github.com/benz-ai-x/dsh-session-graph/releases/tag/v0.1.5-alpha.1) | `0.1.5-alpha.1` | `^22.19.0 || >=24.0.0` | 真实 Host/Client 类型检查、集成测试、打包 profile 启动与读写验证 |
| [`v0.1.6`](https://github.com/benz-ai-x/dsh-session-graph/releases/tag/v0.1.6) | `0.1.2-alpha.1`、`0.1.2-alpha.2`、`0.1.2-alpha.3` | `^22.19.0 || >=24.0.0` | CI、真实 Harness 集成、打包 profile 安装/移除 |
| [`v0.1.5`](https://github.com/benz-ai-x/dsh-session-graph/releases/tag/v0.1.5) | `0.1.2-alpha.1`、`0.1.2-alpha.2` | `^22.19.0 || >=24.0.0` | CI、真实 Harness 集成、打包 profile 安装/移除 |

从当前适配开始，插件版本与目标 DSH 版本完全一致，包括预发布后缀：DSH `0.1.5-alpha.1` 对应插件 `0.1.5-alpha.1`。旧版 `v0.1.0`–`v0.1.6` 保留原标签；使用 DSH `0.1.2-alpha.1`–`alpha.3` 时仍应固定插件 `0.1.6`，新版源码不承诺旧宿主兼容性。不要仅按 npm `latest` 或插件版本号大小选择安装版本。

本预发布版本使用 npm `next` 标签，下方命令固定到与 DSH 匹配的精确版本。如需安装本地构建，请在本仓库运行 `pnpm install --frozen-lockfile`、`pnpm pack --pack-destination .artifacts`，再用 `dsh plugin --profile web add /绝对路径/插件归档.tgz` 安装。

## 核心能力

| 能力 | 你可以获得 |
|---|---|
| 可视化 Session Graph | 在同一视图查看 Branch Lineage、Merge 溯源、Session Cluster 与折叠的 Subagent 活动 |
| 交互式画布 | 拖动、吸附、折叠、过滤、缩放、平移、适应、重新布局、重置、定位与 minimap |
| 跨会话工作流 | 打开任意 Canvas Session、创建 Branch，并汇聚两到三个来源的不可变快照 |
| 讨论原文 | 在 Inspector 按轮次阅读用户/助手文本，选择连续完成轮次，并复核精确来源 |
| 只读 Session Digest | 按需生成简短概览、关键结论和待办，且不改变 Session 日志 |

原文分页、来源恢复、运行中轮次与会话导航的实际操作见[浏览器验收记录与截图](docs/reviews/pr-14-ui-acceptance.md)。

### 数据与模型行为

| 操作 | 持久化影响 | 模型调用 |
|---|---|---|
| 浏览或排列 | 不改变 Session 日志；排列保存在浏览器存储中 | 无 |
| 阅读或选择原文 | 仅在阅读面板打开期间保留选择与备用摘录；不改变 Session 日志 | 无 |
| 生成摘要 | 仅保留按 revision 区分的 Host 内存缓存；不追加消息 | 在 Session 路由或配置的兜底路由上发起一次辅助请求 |
| 创建分支 | 使用 Harness 的常规 Branch 操作 | 本插件不额外发起请求 |
| 汇聚会话 | 创建独立目标和持久快照溯源；来源保持不变 | 目标会话在正常路由上处理排队指令 |

## 安装

从 npm 安装已发布的包，并将其加入 `web` profile：

```sh
dsh plugin --profile web add @benz-ai-x/dsh-client-ui-session-graph@0.1.5-alpha.1
```

确认解析后的 profile 已包含该组合包：

```sh
dsh --profile web --dump-config
```

输出应包含 `name: '@benz-ai-x/dsh-client-ui-session-graph'`。

<details>
<summary>从固定 GitHub tag 安装源码</summary>

```sh
dsh plugin --profile web add github:benz-ai-x/dsh-session-graph#v0.1.5-alpha.1
```

profile 显式授权前，pnpm 会阻止 git 依赖执行 `prepare` 脚本。首次 GitHub 安装会以 `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED` 退出；把 dsh 打印的完整键复制到 `$DSH_HOME/profiles/web/pnpm-workspace.yaml` 的 `allowBuilds` 下，再次执行命令。这项权限允许包代码在 agent 沙箱之外执行，因此应先检查源码，并继续锁定该 tag 或 commit。

</details>

本包同时包含浏览器插件与 `cordis.patch.yml` 组合包补丁。dsh 插件管理器会把它插入 `web` profile 已提供的 Session、Workspace、locale、renderer 与 conversation 插件之后，无需手工修改 `cordis.yml`。

使用以下命令移除：

```sh
dsh plugin --profile web remove @benz-ai-x/dsh-client-ui-session-graph
```

安装或移除后请重启目标 `web` profile。运行中的进程不会监视 profile 依赖列表。

Session、LLM 和浏览器运行时服务仍由所选 dsh profile 持有。插件显式声明 Typert 协议依赖，LLM 使用与 DSH 同版本的 peer dependency；离线恢复命令会打包所需格式目录与库，宿主尚未启动时也可使用；直接引用的所有 `@deepseek-ai/dsh-*` 包均锁定到插件版本。

## 使用图谱

打开一个非空会话，在标准对话标签旁选择 **Graph**。Viewed Session（当前查看会话）会优先解析命名 Workspace Scope（工作区范围），匹配不到时退化为 Directory Scope（目录范围）。

- 单击选择 Selected Session（选中会话）并持续强调其 Branch Lineage；可关闭的详情检查器可打开该会话或创建 Branch，并在 Harness 拒绝请求时显示错误。单击画布空白处或按 Escape 可清除选择。
- 双击会在该会话上次使用的视图中打开它。
- 在其他 Canvas Session 上停留可查看紧凑预览，不会替换 Selected Session 检查器。
- 拖动节点或整个簇框来排列画布；对齐参考线会吸附临近卡片边缘。
- Session Arrangement 持久化采用 fail-soft 策略。浏览器存储不可用、被拒绝、损坏或空间耗尽时，实时图谱仍会使用自动几何继续渲染。
- 每个 Canvas Session 都暴露稳定的顶部输入端子与底部输出端子，为后续图编辑功能预留；Branch 使用中性色带方向实线，Merge Relation 使用品牌色带方向实线，Subagent Derivation 使用虚线。
- 使用滚轮缩放、背景拖动平移、适应、100%、重新布局、重置、定位 Viewed Session（当前查看会话）或 minimap。内容离开可视范围时才显示 minimap；容器尺寸变化会保留当前内容中心与缩放比例。
- 按标题过滤；Enter 居中第一个匹配项，Escape 清空过滤条件。
- 悬停节点或边会强调对应的 Branch Lineage（分支谱系）。
- 查看页头徽标可确认包版本与当前本地 Build ID；悬停可查看完整包身份。

画布获得焦点时可使用键盘快捷键：`+` 和 `-` 缩放，`0` 恢复 100%，`1` 适应图谱。

## 阅读讨论原文

点选 Canvas Session，在会话详情中切换到「原文」，默认展示最近十轮讨论。通过「加载更早的讨论」「加载更晚的讨论」翻到相邻页；没有对应内容时按钮禁用。方向键和 Home/End 也可切换详情标签。

- 已完成轮次展示直接用户文本与助手文本，并标明角色。未完成轮次显示状态，完成后点击「刷新原文」即可选择。不包含附件、工具结果、思考过程或插件注入的上下文。
- 勾选一轮，再勾选另一轮可选择连续范围，包括已加载的前后页。中间有缺口时，先加载缺失轮次；再次点击已选轮次或「清除选择」可清空范围。
- 「复核所选原文」重新读取该精确范围。来源由 Session 身份和事件边界确定，重复标题、相同句子以及后续新增轮次不会改变它。原文可读时优先展示实际原文。
- 「仅存摘录」表示暂时无法读取原文，展示本次选择时保留的文本；重试期间和连接失败后会持续显示此标记，直到重新读到原文。「来源不可用」表示原文与备用摘录均不可展示。来源身份始终可核对，可「重试读取」。可读但没有讨论的会话另有空状态。
- 可取消读取。关闭详情、切换会话或离开原文标签会取消未完成请求，迟到响应不会覆盖新选择。阅读不会改变 Viewed Session；点击「打开会话」才进入 Harness 继续工作，该操作暂不滚动到原生聊天的指定轮次。

选择和摘录仅临时保留：关闭面板、切换到摘要或其他会话、刷新页面都会清除，尚不会保存为知识卡片。阅读、选择、刷新和重试不调用模型，也不写入源会话。

分页限制的是浏览器展示内容；Host 每次仍通过宿主读取单个会话的完整快照，暂不支持底层日志文件分页，因此特别大的单个会话仍可能读取较慢。

## 汇聚会话

点击画布工具栏中的“汇聚会话”，再按卡片上显示的编号顺序选择两个或三个 Canvas Session。检查或修改“汇聚指令”，然后点击“创建汇聚会话”。

- 来源必须互不重复，且必须是同一 Workspace 或工作目录中非空、非 Subagent 的 Canvas Session。
- 所有来源都必须在画布中选择。汇聚指令不能包含 `dsh-session:` 引用，因为 Harness 会把这种引用保留给精确的来源快照集合。
- Harness 会创建一个独立目标 Session，以来源标题命名，并在不可变的事件边界捕获每个来源。来源会话及其已有 Branch Lineage 都不会被修改。
- 提交时 Host 会重新检查目标与每个来源，不信任浏览器元数据。它只接受目标目录内非空、未归档、非 Subagent 的 Canvas Session 来源，以及没有父 Session 的空白目标或来源顺序完全一致的重试目标。
- 目标会话的正常 agent loop 会收到编辑后的指令和 Harness 规范 Session 引用。本功能不会另选“摘要模型”；队列请求被处理时，目标会话使用其正常配置的模型路由。
- Merge Session 始终属于自己的 Session Cluster。品牌色 Merge Relation 只表达来自各来源簇的溯源关系，不会把来源变成父会话。
- 选中 Merge Session 后，Session Inspector 会列出来源标题及快照边界。汇聚溯源由目标日志投影，并写入 Harness 的持久 Projection Cache，因此重启与冷日志重放后仍能恢复。
- 若目标创建成功，但命名、快照提交、持久化或打开失败，目标会被保留。“重试”会复用该目标，不会重复创建；上一次尝试延迟完成的快照仅在有序来源集合完全一致时才会被接受。Host 一旦开始把匹配捕获提交到持久投影存储，关闭视图也不会再取消该提交。也可以直接点击“打开目标会话”恢复处理。

提交前可以取消来源选择。提交开始后，控件会锁定到成功或产生可恢复错误为止；离开该视图仍会中止浏览器请求。Host 等待快照也有时间上限，超时会作为可重试的快照提交失败呈现。

## 恢复旧版 Merge 会话

旧插件写入的 `session-graph-merge` 消息来源会被 DSH `0.1.5-alpha.1` 的 V0/V1/V2 日志迁移拒绝，导致该会话正文无法读取。新 Merge 使用宿主标准 `plugin` 来源，升级插件不会自动修复已有文件。

在本仓库安装依赖后，对明确选定的历史文件运行恢复工具。第一条仅校验，第二条在已存在的输出目录生成独立 V3 文件：

```sh
node scripts/migrate-merge-history.mjs --input /path/session.v2.jsonl.zstd
node scripts/migrate-merge-history.mjs --input /path/session.v2.jsonl.zstd --output /separate/recovered/session.v3.jsonl.zstd
```

工具支持明文 JSONL、`.zst` 和 `.zstd`；仅转换本插件可识别的旧标记，并通过 DSH 官方完整格式迁移及当前格式校验。原文件保持不变，已有输出文件不会被覆盖。默认输入及解压后数据上限为 128 MiB，可用 `--max-bytes` 调整；无法识别的字段、损坏或截断数据会被拒绝。已是 V3 或没有旧标记的会话应使用 DSH 正常读取/迁移流程。

若要让宿主使用恢复文件，先停止 DSH，再将验证后的文件以 `session.v3.jsonl` 或 `session.v3.jsonl.zstd` 放入**该会话原有目录**并保留原文件；若已有 V3 文件，先核查冲突，不能直接覆盖。工具只生成文件，不扫描或替换真实会话。安装包也提供同名命令 `dsh-session-graph-migrate`。

## 生成会话摘要

选择任意非空 Canvas Session，在 Session Inspector（会话检查器）中点击“生成摘要”。摘要绝不会自动生成，生成期间也不会禁用“打开会话”或“开新分支”。

- Host 会检查准确的 Selected Session，即使它并非 Viewed Session。输入只保留用户直接发送的消息与 assistant 最终文本，排除推理过程、工具结果和插件注入上下文。
- 模型输入上限为 32 KiB。长会话优先保留最初用户目标、最近一次 compaction checkpoint，以及容量允许的最近对话。
- 辅助请求不开放工具，要求返回结构化的简短概览、关键结论与待处理事项。它优先使用会话日志中最近记录的 provider/model 路由；可选配置仅作为兜底。
- 会话运行中生成的结果标记为“运行中快照”。后续新活动会把可见摘要标记为“会话有新内容”，但不会隐藏旧内容；点击“更新摘要”即可替换。
- 成功结果按 Session 与源 revision 缓存在 Host 内存中。“重新生成”会绕过缓存；空内容或失败不会被当作成功摘要缓存，可继续重试。
- 同一 revision 的并发请求只执行一次模型调用，但各调用方的取消互不连带。插件关闭时会停止接收新摘要、取消自有工作，并等待已接收请求全部结束后再移除服务。

这是一次额外模型请求，可能产生所选 provider 的常规费用。摘要文本只是只读投影：它不是对话消息，不进入 Session 日志，也不改变 Session Lineage。

大多数会话无需配置，因为日志已记录模型路由。对于没有路由的旧会话或导入会话，可在 profile 的 `cordis.yml` 中覆盖已安装插件条目：

```yaml
- id: ui-session-graph
  config:
    provider: deepseek-official
    model: deepseek-v4-flash
    maxOutputTokens: 800
    timeoutMs: 60000
```

`provider` 与 `model` 必须成对提供，并且绝不会覆盖会话已记录的路由。`maxOutputTokens` 默认为 `800`，`timeoutMs` 默认为 `60000`。插件激活会通过对外导出的 Standard Schema 校验配置，并拒绝空白路由、缺少配对字段、非整数与非正数限制。

## 故障排查

| 现象 | 首先检查 |
|---|---|
| 找不到 **Graph** 标签 | 重启 `dsh web`，打开非空 Session，并确认 `dsh --profile web --dump-config` 中存在本包 |
| Host 在 Remote error 导出附近启动失败 | 按兼容表安装与 DSH 匹配的插件，并确认解析后的 profile 没有保留旧包版本 |
| GitHub 源码安装报告 `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED` | 检查固定版本源码，把 dsh 打印的完整键加入该 profile 的 `allowBuilds`，然后重试 |
| 生成摘要时报告没有模型路由 | 使用日志中带路由的 Session，或配置 `provider` 与 `model` 兜底字段对 |
| Web URL 拒绝访问 | 打开 `dsh web` 打印的完整认证 URL；不要复用或分享被截掉 token 的地址 |

若问题仍然存在，请在 [GitHub Issue](https://github.com/benz-ai-x/dsh-session-graph/issues/new) 中附上 Graph 页头显示的包版本、Harness 版本以及相关 Host/浏览器错误。

## 开发与贡献

环境要求为 Node.js `^22.19.0 || >=24.0.0` 与 pnpm `11.7.0`。

```sh
pnpm install --frozen-lockfile
pnpm run check
```

`pnpm run check` 会检查独立包的类型、构建 Host 与浏览器入口，并运行包内测试套件。若要对已准备好的 DeepSeek Harness checkout 运行 Host 与完整交互集成测试套件：

```sh
pnpm --dir /path/to/deepseek-harness run build:native-system
pnpm --dir /path/to/deepseek-harness run build:lib
DSH_HARNESS_ROOT=/path/to/deepseek-harness pnpm check:harness
```

修改 Session、Merge、Digest 或持久化行为前，请先阅读 [`CONTEXT.md`](CONTEXT.md) 的领域模型与 [`docs/adr/`](docs/adr/) 的持久设计决策。安装方式或产品行为变化时必须同时更新本文与 [`README.md`](README.md)。面向用户的工作应从 [GitHub Issue](https://github.com/benz-ai-x/dsh-session-graph/issues) 开始。

`check:harness` 要求宿主与插件版本相同。它用该 checkout 构建的真实公开声明检查 Host/Client 源码及打包声明，不加载独立测试用的宿主声明替身；随后运行真实 Session、持久化、历史恢复与 UI 集成测试。CI 在 Node.js 22.19、24 与 26 上运行独立检查，并从 `package.json` 自动选择 `dsh-v<version>`。打包验收在临时 `web` profile 中安装归档、启动真实 Host、验证 Merge 持久化及 Digest/History 只读行为，再移除插件。History 读取还经过与浏览器相同的 RPC Gateway，覆盖传输层提供的取消信号；仅模型传输使用固定响应。

使用以下命令构建可安装归档：

```sh
pnpm pack --pack-destination .artifacts
pnpm --dir /path/to/deepseek-harness run build:web
DSH_HARNESS_ROOT=/path/to/deepseek-harness pnpm smoke:harness
```

本地构建会根据 `package.json`、`tsdown.config.ts` 与 `src/` 内容生成稳定的 `local-<hash>` Build ID；发布流水线可在构建时设置 `DSH_SESSION_GRAPH_BUILD_ID` 来替换它。

### 发布

[Publish workflow](.github/workflows/publish.yml) 接受已发布的 GitHub Release 或手工提供的现有 tag。它要求 tag 等于 `v` 加包版本，重新运行 `pnpm run check`，打包归档，并把这些已验证字节发布到 npm；稳定版使用 npm tag `latest`，预发布版使用 `next`。

本包使用 [npm trusted publisher](https://docs.npmjs.com/trusted-publishers/)：organization 为 `benz-ai-x`、repository 为 `dsh-session-graph`、workflow 为 `publish.yml`、environment 为 `npm-publish`，仅允许 `npm publish` action。工作流通过 GitHub OIDC 认证，不应再接收长期 `NPM_TOKEN`；保留 GitHub environment 作为发布边界。若为其他包名或 scope 做首次发布，只在首次引导时使用权限范围尽量小、有效期尽量短的令牌，随后立即配置 trusted publishing 并吊销该令牌。

每次适配发布都必须把 `package.json.version` 及直接引用的 DSH 依赖更新为目标 DSH 的完整版本；插件 tag 为 `v<version>`，上游 tag 为 `dsh-v<version>`。`check-version.mjs` 会拒绝依赖或发布 tag 不一致，`check:harness` 会拒绝宿主版本不一致。发布前完成 `pnpm run check`、`check:harness` 和打包 profile 验收，并确认 Graph 页头徽标读取同一版本，再合入变更、创建不可移动的 tag 和 Release。相同 DSH 版本下的本地迭代使用 Build ID 区分，不覆盖已发布版本或重命名历史标签。

本包导出两个 Node 侧入口和一个惰性加载的浏览器模块；实际打包归档中的每个 JavaScript 入口都带有匹配的 TypeScript 声明：

| 导出 | 用途 |
|---|---|
| `.` | 用于生成 Session Digest 与持久提交 Session Merge 的 Cordis Host services |
| `./invariant` | 运行时注册不变量 |
| `./client` | 构建后的 dsh 客户端模块 |
| `./cordis.patch.yml` | profile 组合包补丁 |

## 实现

`GraphView` 读取 Viewed Session、Workspace 成员关系、会话摘要与待处理交互映射。带索引的纯 helper 推导 Session Cluster、Branch 与 Merge 边、Subagent Summary、跨簇顺序、布局、吸附、Title Filter 匹配与视口状态；独立 presentation pipeline 再按顺序应用节点位置、折叠状态和簇偏移，最后交给 `GraphCanvas` 渲染。Host 通过两个包自有 Remote 分别提供只读 Session Digest 与原子 Session Merge 捕获；Merge 提交会重新校验 Host 权威状态、排入显式 marker 与规范引用，等待匹配投影，再写入 Projection Cache，之后才报告成功。

| 文件 | 职责 |
|---|---|
| [`src/client/GraphView.tsx`](src/client/GraphView.tsx) | Workspace/Directory Scope 解析、图谱推导与视图头部 |
| [`src/client/GraphCanvas.tsx`](src/client/GraphCanvas.tsx) | 画布渲染、端子、检查器、控件、手势、悬停状态与 minimap |
| [`src/config.ts`](src/config.ts) | 对外 Standard Schema、默认值与规范化 Host 配置 |
| [`src/index.ts`](src/index.ts) | Session Digest 与 Session Merge Host services、投影注册、配置和 Remote 错误 |
| [`src/session-digest.ts`](src/session-digest.ts) 与 [`src/session-digest-harness.ts`](src/session-digest-harness.ts) | 事件过滤、输入预算、路由重建、输出校验、revision 缓存与并发控制 |
| [`src/session-merge.ts`](src/session-merge.ts)、[`src/session-merge-host.ts`](src/session-merge-host.ts) 与 [`src/session-merge-harness.ts`](src/session-merge-harness.ts) | 浏览器流程、Host 校验、规范引用提交、有界捕获、幂等重试与持久性屏障 |
| [`src/session-merge-projection.ts`](src/session-merge-projection.ts) | 版本化 Merge marker/reference 投影与严格持久状态校验 |
| [`src/session-history-host.ts`](src/session-history-host.ts) 与 [`src/session-history-codec.ts`](src/session-history-codec.ts) | 只读讨论分页、精确事件边界与共享的严格通信校验 |
| [`src/client/SessionHistory.tsx`](src/client/SessionHistory.tsx) | 原文阅读、完成轮次选择、来源状态与请求取消 |
| [`src/client/session-digest-remote.ts`](src/client/session-digest-remote.ts) | 严格的浏览器 Remote 请求/结果契约 |
| [`src/client/session-merge-remote.ts`](src/client/session-merge-remote.ts) | 严格的浏览器 Session Merge Remote 请求/结果契约 |
| [`src/client/graph-model.ts`](src/client/graph-model.ts) | 图谱范围解析、Branch 与 Merge 边、Session Cluster 排序、Subagent Summary、Title Filter 匹配与 Branch Lineage |
| [`src/client/canvas-presentation.ts`](src/client/canvas-presentation.ts) | 有序 Session Arrangement 投影以及最终/自动内容边界 |
| [`src/client/layout.ts`](src/client/layout.ts) 与 [`src/client/clusters.ts`](src/client/clusters.ts) | 树坐标、簇框、折叠、偏移与边路径 |
| [`src/client/viewport.ts`](src/client/viewport.ts)、[`src/client/preview-placement.ts`](src/client/preview-placement.ts) 与 [`src/client/snap.ts`](src/client/snap.ts) | 缩放、平移、尺寸保持、适应、minimap/预览定位与对齐参考线 |
| [`src/client/layout-store.ts`](src/client/layout-store.ts) | 按范围的 Session Arrangement 持久化、迁移与 fail-soft 存储恢复 |

## 当前限制

- 无会话主页与全新空白会话没有对话视图环，因此无法使用 Graph。
- 图谱一次只跟随一个 Workspace Scope 或 Directory Scope，不搜索消息内容或工作目录路径。
- 切换标签或刷新会重置平移与缩放；节点位置、簇偏移与折叠状态会持久化。
- Session Digest 只按需生成并缓存在 Host 内存中，不作为长期产物持久化；Host 重启会清空缓存。
- 没有日志模型路由的 Session 必须配置兜底路由后才能生成摘要。
- 从 Subagent Session 创建的 Branch 没有 Canvas Session 父边，因此显示为 Root Session。
- 一次 Merge 只接受两个或三个来源，且所有来源必须能在目标工作目录中解析；暂不支持跨 Workspace 汇聚。
- Merge 捕获的是不可变来源快照；来源后续新增消息不会自动刷新已有 Merge Session。
- 触屏只使用指针事件回退，没有专用控件。

## 许可证

[MIT](LICENSE)
