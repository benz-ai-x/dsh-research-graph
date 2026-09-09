# Session Graph Handoff

Updated: 2026-09-09 (Asia/Shanghai)

## 当前发布：v0.1.5-alpha.1 已完成

用户已明确要求“发布”。适配提交 `b9025944d3eff161e779479383f3451a078d3622` 已推送到 main，不可变 annotated tag `v0.1.5-alpha.1` 指向该提交；GitHub prerelease 与 npm `next` 均已发布。插件完整版本与目标 DSH `0.1.5-alpha.1` 一致。

- [GitHub Release](https://github.com/benz-ai-x/dsh-session-graph/releases/tag/v0.1.5-alpha.1)，包含中英文说明、与 npm 相同的安装包及 SHA-256 文件。
- [npm 0.1.5-alpha.1](https://www.npmjs.com/package/@benz-ai-x/dsh-client-ui-session-graph/v/0.1.5-alpha.1)，发布时间 `2026-09-09T04:22:39.710Z`。`next` 为 `0.1.5-alpha.1`，`latest` 保持历史稳定版 `0.1.6`；安装时固定新版本。
- [发布前 CI](https://github.com/benz-ai-x/dsh-session-graph/actions/runs/34310355327) 全部通过：Node 22.19/24/26，以及匹配 DSH 的源码/产物类型检查、110 项集成测试和隔离 profile 验收。[Publish 工作流](https://github.com/benz-ai-x/dsh-session-graph/actions/runs/34310684897) 成功，使用既有 GitHub OIDC trusted publishing。
- 已从 npm 下载并验证实际归档的 SHA-512 integrity、包版本、恢复命令入口和浏览器版本徽标；npm 提供 provenance attestation。最终发布归档 `224,231` 字节，SHA-256 `30c3ae874262898c6cc501b1e2a3967cb7e144cd09f86ff04470a0820c8aa0c6`，本地材料在 `.artifacts/published-v0.1.5-alpha.1/`。下文适配阶段的本地归档校验值保留作历史记录，发布物以本节为准。

安装命令：`dsh plugin --profile web add @benz-ai-x/dsh-client-ui-session-graph@0.1.5-alpha.1`。本次发布没有替换用户实际 profile 或迁移真实会话数据。本节覆盖下文“尚未提交/发布”的历史状态。

## 当前任务：适配 DSH 0.1.5-alpha.1 并对齐版本命名

用户已要求认真复核兼容性、制定 TODO 并修改；以后插件版本与所适配的 DSH 版本一致。本次目标源码为 `/Users/pc2026/DSH-Space/deepseek-harness`，提交 `5dda764ed3aa172535a7967b06ff95d9cbfe536a`。当前工作区为 `/Users/pc2026/DSH-Space/dsh-session-graph`。下文的旧暂停点保留为历史记录，本节是当前任务状态。

- [x] 用当前真实 Session / 持久化接口建立回归测试，修复摘要读取和 Merge 目标解析。
- [x] 将新 Merge 标记改为宿主公开的 plugin message source，保留已有标记的投影识别；提供保留原文件的历史日志恢复工具。
- [x] 修正 Host 直接依赖及类型声明，加入目标 Harness 的源码和打包声明类型检查。
- [x] 将插件版本改为 `0.1.5-alpha.1`，统一依赖、CI、发布校验与双语文档的版本规则。
- [x] 完成最终归档的隔离 Loader/profile 验收，并记录全部验证结果。

复核基线：摘要的已移除 `sessionPersistence.inspect()`、Merge 的已移除 `session.events`、旧 Merge 标记的 V0/V1/V2 迁移拒绝均已用隔离探针复现。构建通过，独立测试 167/167；原 Harness 集成 96/97（前端 87/87），失败项是旧缓存测试参数；仅在内存中适配该测试参数后通过。`pnpm run check` 在类型检查失败，普通 Node 加载构建产物缺少 Typert 直接依赖。尚未修改或迁移任何真实会话数据。


当前实现：Digest 改用 `sessionController.inspect(id, signal)`，Merge 读取 `snapshotEvents()`。新标记使用 `source.kind: plugin`、`plugin: dsh-session-graph`、`form: notice` 和 `summary`，版本化操作/来源信息置于末尾文本块；不能在标准 source 中增加自定义字段。旧标记解析继续保留。投影使用真实 Zod schema，移除了不受支持的 LLM `purpose`；Workspace ID 在宿主调用处使用真实品牌类型。

类型与依赖：直接 Typert 依赖、LLM peer/dev 依赖、开发用格式目录和 attachment 与 DSH 同版本；Zod 固定 `4.4.3`。移除遮蔽真实 Cordis、LLM、Typert 的 ambient 声明，独立构建的少量 Host/Client 适配声明不进入 `check:harness`。该命令分别检查 Host 源码、Client 源码、Host 打包声明、Client 打包声明；产物检查曾真实发现 `SessionId` 品牌被重复打包的冲突，已通过声明构建外部化宿主包修复。CI 自动检出 `dsh-v<package.version>`，准备宿主原生/库/Web 产物并运行集成与打包验收。

历史恢复：`scripts/migrate-merge-history.mjs` / 安装后的 `dsh-session-graph-migrate` 默认仅检查；安装命令使用包含格式目录及依赖的独立 `lib/migrate-merge-history.js`，无需宿主先启动以提供 peer 包；明确 `--output` 后才生成独立 V3 文件。覆盖 V0/V1/V2 明文与 `.zst`/`.zstd`；只转换已识别的本插件旧 marker，完整运行官方迁移并再次校验当前格式，保留消息 ID 与来源边界。输入及解压后数据默认限 128 MiB；检测原文件变化、拒绝未知 marker 字段、截断输入、覆盖已有输出及原地替换。放回真实会话目录的步骤见 `README.zh.md`，本次没有读取或处理真实历史会话。

版本政策：本次与目标 DSH 完全一致（包括 `alpha.1`），插件 tag 保持 `v<version>`；旧独立版本 `v0.1.0`–`v0.1.6` 不重命名。旧 DSH `0.1.2-alpha.1`–`alpha.3` 使用历史插件 `0.1.6`，本条源码不再声明旧宿主兼容性。相同 DSH 版本下的本地迭代用 Build ID 区分，不覆写已发布版本。尚未 commit、push、发布 npm/GitHub Release 或替换用户的实际 profile。


最终验证（2026-09-09，macOS arm64 / Node `26.4.0` / pnpm `11.7.0`）：

- `pnpm install --frozen-lockfile` 通过；`pnpm run check` 通过，18 文件、169/169 独立测试，含普通 Node 加载 Host 产物和独立恢复命令。
- `DSH_HARNESS_ROOT=/Users/pc2026/DSH-Space/deepseek-harness pnpm check:harness` 通过：Host/Client 源码及打包声明四组真实类型检查，4 文件、110/110 集成测试（含 87 项 UI 测试）。恢复测试同时比较源码工具与普通 Node 执行的独立打包命令，覆盖 6 种历史版本/编码组合及拒绝覆盖、截断和未知标记等情况。
- `pnpm pack --pack-destination .artifacts` 通过。最终归档 `.artifacts/benz-ai-x-dsh-client-ui-session-graph-0.1.5-alpha.1.tgz`，223,462 字节，SHA-256 `2ef4b5afcaa598f096e5b18b2bc85b066c7ad8b171911bb98778f812fd64ca0b`；包含独立恢复命令、声明及第三方许可证，浏览器产物包含同一版本徽标。
- `DSH_HARNESS_ROOT=/Users/pc2026/DSH-Space/deepseek-harness pnpm smoke:harness` 对该归档通过：在临时 web profile 安装、首次 Host 启动前运行安装后的恢复命令、通过真实 DSH launcher/Loader 启动、以两个实际测试会话验证 Merge 持久化和来源日志不变、验证 Digest 只读、关闭并移除插件。模型传输是固定响应，7 次调用均为本地 fixture；没有真实模型请求。临时目录已清理。
- 发布版本校验接受 `v0.1.5-alpha.1`、拒绝旧 `v0.1.6`；`git diff --check` 通过。目标 Harness 源码保持 clean。Node 22/24 的 CI 配置已更新，本地只执行上述 Node 26 验证，未运行远端 CI。

本轮兼容性 TODO 已全部完成。下一次发布或安装到实际 profile 时应以本节的未发布版本与新命令为准；不要将下文历史审计、旧版本清单或暂停描述当成当前源码状态。后续七项功能路线图的 Issue 拆分仍保留在历史记录中，本轮没有推进那些功能。

> This root `HANDOFF.md` is the only canonical live handoff for this repository. Update it in place for future handoffs; do not create another handoff file. The former `session-graph-handover.md` is intentionally deleted, and `docs/HANDOFF.md` is retained only as a historical project snapshot.

## 历史暂停点：七项需求的开发分析与 GitHub Issues

用户最新指令是：“先写交接文档，我要关机处理一些事情”。本次只保存交接，停止后续研究、Issue 创建和实施，等待用户回来继续。

暂停前的请求是：“针对这些需求，你能不能帮我深入分析应该如何开发实现，形成issue，我想都做了”。用户已授权把全部需求分析成实际 GitHub Issues；恢复后应完成分析并创建 Issues，无需再次询问是否创建。这个请求本轮推进到方案研究，尚未开始功能实施。下文已有的新版兼容性审计与实施清单来自此前工作，完整保留；恢复本轮任务时先完成需求和 Issue 拆分。

**暂停状态：** GitHub 仓库 `benz-ai-x/dsh-session-graph` 的 open Issues 列表再次核实为空；本轮没有创建 Issue、PR 或新标签，没有提交或推送产品代码。`HANDOFF.md` 在本次交接前已有未提交的兼容性审计更新，本次在其基础上合并记录，不能用 Git 版本覆盖它。当前 `main` 为 `b533c933eb24d531fe3135c785db7b813c59fb5c`，较本地 `origin/main`（`3eba84d6231c0cb54ddb1d79aa94d059b88ac87d`）领先两个提交，必须保留。

### 全部需求与建议拆分

原始七项需求：新版 Harness 兼容性、重要会话收藏、正文搜索并定位图谱、图谱与原生聊天并排、大量会话的性能与故障处理、稳定会话链接及位置恢复、来源/渠道筛选。

建议建立一个 `wayfinder:map` 总 Issue 和至少八个 `wayfinder:task` 子 Issue。额外的公共面板/定位模块是多项功能的前置工作。以下为尚未发布的拟定内容；不要把这里的序号当成 GitHub Issue 编号。

| 标识 | 优先级 | 拟定 Issue | 前置工作 |
| --- | --- | --- | --- |
| A | P0 | 适配 Harness 0.1.5-alpha.1，并补齐真实 Host、类型和打包验证 | 无；合并下文已有兼容性审计，历史 Merge 迁移必要时独立拆单 |
| B | P1 | 提取可复用 GraphPanel 与统一节点定位、面板状态模块 | A |
| C | P1 | 消除大图重复扫描和深递归，增加视口裁剪与失败恢复 | B；纯算法改造可提前准备 |
| D | P1 | 收藏重要会话，提供持久化收藏入口和图谱定位 | B |
| E | P1 | 接入宿主正文搜索，支持范围内分页、摘要片段和节点定位 | B |
| F | P1 | 注册右侧栏 Graph 标签，实现原生聊天与图谱并排 | B |
| G | P2 | 提供稳定会话/节点链接，恢复选中节点及视口 | F |
| H | P2 | 根据有证据的来源元数据展示渠道并筛选会话 | B |

这些依赖是当前设计建议，尚未在 GitHub 建立。创建时每个 Issue 都应包含问题、现有证据、模块改动、数据与持久化约定、取消/错误处理、验收标准、测试和依赖，不能只贴功能标题。

### 已核对的实现方向

**A：兼容性。** 本轮源码核对目标为官方 `dsh-v0.1.5-alpha.1` / `5dda764ed3aa172535a7967b06ff95d9cbfe536a`，而现有 CI 只覆盖 `0.1.2-alpha.1`–`alpha.3`。`src/index.ts` 的 Digest 仍调用已移除的 `sessionPersistence.inspect()`；`src/session-merge-harness.ts` 仍读取已移除的 `session.events`。当前公开替代包括 `sessionController.inspect(id, signal)` 和 `Session.snapshotEvents()`。`form: 'notice'` 的当前声明还要求 `summary`，应核对 Merge marker 写入。不要把移除 `ctx.agent` / Inbox 的发布说明自动归为本插件的问题。下文的既有审计还记录了历史 Merge 日志迁移失败与依赖问题，必须一并纳入 A；不能只修两处调用就宣称全部兼容。保留旧版本支持与否未定，不能默认放弃。

**B：公共面板与状态。** `src/client/GraphView.tsx` 目前直接依赖 `ConvViewProps`；`GraphCanvas.tsx` 约 1,880 行，集中管理视口、选择、布局、筛选、Merge、Digest 和手势。建议把宿主适配与可复用 `GraphPanel` 分开，让 conversation.view 和 sidebar.right.pane.tab 各自提供普通业务参数。提供小而明确的节点定位入口，统一完成选择、居中、必要的显示处理与 DOM 焦点恢复；禁止各功能自己 `document.querySelector` 全局抢焦点。当前键盘导航恰有全局查询，双实例会产生错误目标。

状态建议：Session Arrangement 继续按既有 Workspace/Directory 身份共享；选择、视口和手势按展示实例保存，避免两个面板互相跳动；收藏以 Host + Session ID 为身份，在当前图谱范围展示。优先复用公开 `ctx.remote.$host.home` 与浏览器 origin 构造本地命名空间，等待 Host 就绪再恢复，连接更换需清理旧请求。若使用路径摘要，明确它只是命名空间，不是安全或跨设备身份。仍需在 Issue 中固定完整状态键、跨标签页更新和保存失败行为。不要把收藏塞进 Reset 会清空的布局记录，也不要将会话正文复制进浏览器存储。

**C：性能。** `resolveGraphScope()` 的成员判断重复 `sessionIds.includes`；`clusters.ts:clusterFrames()` 每个簇都扫描全部节点，而且 `deriveCanvasPresentation()` 同时为当前/自动布局计算两遍；`GraphCanvas.tsx` 每条边用 `shown.nodes.find` 找终点，节点、边和 minimap 全量渲染。`deriveSessionGraph()` / `layoutSessionGraph()` 有递归，多个边界计算采用 `Math.min/max(...array)`。建议先建立 ID/簇索引、单遍边界计算和带 visited 的迭代遍历，再将拓扑/几何更新与运行状态/悬浮/选中分开，最后增加视口裁剪及低缩放轻量显示。裁剪后 Fit、minimap、拖拽和键盘定位仍应基于完整图的数据；缩到全景不能重新产生海量完整卡片。宿主会话列表冷启动延迟与插件计算耗时分别计量；插件展示 loading/error/retry，不接管宿主日志迁移，也不在图谱启动时读全部正文或生成 Digest。

**D：收藏。** 收藏按钮可放节点及 Session Inspector，提供当前范围内的收藏列表和定位入口。以稳定 Session ID 记录，重命名后仍有效；同一会话在不同范围中的收藏状态一致。建议首版浏览器本地持久化，版本化 schema、损坏/配额失败恢复和跨标签页通知；不承诺跨设备同步。不因临时断线/列表未就绪就删收藏；归档/缺失会话按可用性处理。明确收藏操作不触发模型调用、不修改 Session 日志，不改变 Viewed Session。

**E：搜索。** 当前 Harness 的 `packages/client/ui-workspace/README.md` 已记录原生标题/Workspace + 正文搜索，`ctx.sessions.search(query, signal)` 已公开，但返回的是跨范围最多 20 项及 `hasMore`。如果先取这 20 项再按工作区过滤，会漏掉该范围内的真实命中。因此建议插件通过自己的薄 Host Remote，复用 `ctx.sessionQuery.searchSessions(request, { signal })`，由 Host 解析 Viewed Session 的真实范围并在排序/分页之前设置 `sessionFilters: [{ kind: 'id', values }]`；若 Client 提供进一步筛选 ID，也必须与 Host 范围取交集。正文限定当前 surface 的 user/message 与 assistant/message，保留 snippet、游标，定义游标与 query/scope/filter/连接代际的绑定。

源码重点：`packages/api/session-controller/src/list.ts`、`packages/session-query/session-query/src/types.ts`、`packages/session-query/session-query-sqlite/src/index.ts`。请求去抖约 250ms，AbortSignal 贯穿、旧请求结果不得覆盖新查询；失效游标至多有界重试。**官方 base/web-app 配置仍为 `openAt: never`，索引默认关闭**，虽然 schema 默认是 startup。Issue 必须写清可选 profile patch 启用 `first-search` 的步骤（该 Loader 替换整个 config，需保留必要字段），未挂载/禁用/首次索引/失败的分别提示，保留本地 Title Filter。插件不能偷偷修改全局索引配置。当前原生 UI 没有跳到命中事件的公开能力，首版承诺命中片段和图谱节点定位，不承诺原生聊天事件滚动。

**F：并排。** 新版 `@deepseek-ai/dsh-client-ui-sidebar-right/client` 提供 `ctx.sidebarRightTabs.register(definition)` 和 keyed slot `sidebar.right.pane.tab`。照 `packages/client/ui-sidebar-files/src/client/index.ts` 的“两段注册 + ctx.effect + slots.inject”方式接入，类型 kind 建议 `session-graph`，通过 `ctx.sidebarRight.openTab('session-graph', { params })` 打开。使用 `useTabInfo()` 的 `tab.visible` / `tab.signal` / `navigation.revision` / 绑定 Session 的 actions；隐藏不等于被关闭，signal 也不会仅因切换 Session 而 abort，需明确各类工作的暂停/取消所有权。选择节点仍只改变 Selected Session，显式打开才改变 Viewed Session。复用原生聊天，不嵌套第二个 composer；GraphView 的 `data-conversation-composer-overlay` 只能放 conversation 适配层。支持窄宽度、resize、浮动/分栏、双实例与卸载测试。侧栏 docking 布局是宿主的 Session 级内存状态，刷新后不会自动恢复；公开服务没有布局 snapshot/subscription、find 或 features，不能导入内部 dockkit 实现绕过。

**G：稳定链接。** 建议由插件自有、版本化的 URL fragment 承载导航意图，使用稳定 anchor/selected Session ID 和可选 Workspace ID，不用标题或布局像素坐标做身份。生成链接时保留应用部署路径，清除认证 token 和非必要查询参数；不得把 cwd、home、正文或 Digest 放到 URL。解析后等待连接与 Session/Workspace 列表就绪，先通过公开 sessions.open 选定 Viewed Session，再用 F 的 sidebar openTab + params 定位 Selected Session。只有公开 conversation view owner 的 openView 回调可用时才使用它，不能假设全局 conversation 服务有切换视图方法。记录重复导航、hashchange/popstate、归档/缺失/范围变化和用户在等待期间再次导航的处理。该 URL 语法与登录后恢复流程尚未实现或端到端验证；不承诺跨 Host 可打开同一数据。视口恢复应另存 Host/Scope/展示实例的中心点与缩放，经过容器测量后应用，明确显式链接定位优先于旧视口。

**H：来源/渠道。** 当前 `SessionHeader.origin` 只有 `subagent`，不能据其缺失推断 Web；通用 `source.channel` 也不是所有会话都有的宿主字段。可根据实际已记录的 `user/message.data.source` 识别：带有效 rpcId 的 user 来源标为 Web/RPC；已声明的 webhook 来源可按 provider 分类；第三方 channel 字段仅在支持的生产者约定及运行时校验后识别。保留 unknown/mixed/读取失败，不能按标题、cwd 或 Agent 名猜飞书/Telegram。建议增加小型、可重建的 `sessionGraphSource` projection；当前 projection 的 `init(header, inheritedEventCount)` 可用于排除 Branch 继承前缀，避免把父会话或 Merge 快照的渠道错误地当成本会话的输入来源。只折叠本会话自己的输入，记录有限渠道集合和证据序号，不把用户/群/投递 ID 全量送到节点。冷会话先消费已有 projection cache，缺失显示未知，可按需、有界、可取消补读；不在启动时回放全部冷日志。渠道匹配属于呈现/检索，不重定义 Scope、Branch/Merge 或 Session Cluster；与 Title Filter/正文结果组合的规则需在 Issue 固定。

### 本轮验证与已排除的问题

在 Apple M5 Pro / arm64 / Node `v26.4.0` 上运行了纯函数合成数据探针（每个成功场景 3 次取中位数，未含 React/浏览器渲染）：

| 数据 | scope | derive | layout | presentation |
| --- | --- | --- | --- | --- |
| 1,000 个独立 Root Session | 0.4ms | 0.8ms | 0.4ms | 4.9ms |
| 5,000 个独立 Root Session | 7.6ms | 3.5ms | 1.4ms | 121.8ms |
| 10,000 个独立 Root Session | 29.3ms | 7.0ms | 2.3ms | 782.8ms |
| 5,000 / 10,000 层 Branch 链 | — | `RangeError: Maximum call stack size exceeded` | 未到达 | 未到达 |

这些结果是当前瓶颈证据，不是浏览器 FPS、P95 或未来性能承诺。恢复时为 Issue 定义固定数据集、生产构建和明确的性能验收环境。

曾在进度消息中怀疑图谱漏用了 scope.members，**已明确撤回**：当前 Git 提交含该判断，合成探针正确排除了其他工作区和归档会话；`pnpm exec vitest run tests/graph-model.client.spec.ts` 的 20 个测试全部通过。不要创建虚假的范围错误 Issue。本轮没有运行完整 `pnpm run check`，也没有做新版安装/运行验证；下文其他兼容性审计的测试结果应保留其原始运行范围，不能合并成“全套通过”。

探针及结果位于 `.artifacts/session-graph-roadmap-2026-09-09/probe.mjs` 和 `probe-results.json`，可运行 `node .artifacts/session-graph-roadmap-2026-09-09/probe.mjs` 复现。`.artifacts/` 为忽略的本地材料，不提交；关键结论已写进本文。

### 讨论与前序任务的可续用材料

- Discussions 调研缓存：`.artifacts/harness-discussions-2026-09-09/`，包含 recent、interactive、focused、deep、opportunities、official-replies 等 JSON。社区讨论是需求证据；接口与可行性以精确 tag 的源码为准。
- 收藏需求：[Discussion #5619](https://github.com/deepseek-ai/deepseek-harness/discussions/5619)；搜索：[Discussion #4752](https://github.com/deepseek-ai/deepseek-harness/discussions/4752)；并排：[Discussion #5934](https://github.com/deepseek-ai/deepseek-harness/discussions/5934)。这些帖子的旧版本限制不能直接套到新版。
- 大量冷会话：[Discussion #5961](https://github.com/deepseek-ai/deepseek-harness/discussions/5961)；链接：[Discussion #1039](https://github.com/deepseek-ai/deepseek-harness/discussions/1039)；渠道：[Discussion #3897](https://github.com/deepseek-ai/deepseek-harness/discussions/3897)；版本适配：[Discussion #5874](https://github.com/deepseek-ai/deepseek-harness/discussions/5874)。
- 用户先前要求 GitHub SEO 必须含 `dsh-plugin` topic：已完成 topic/description 与双语 README 优化，发布文档提交 `3eba84d`。保留 `dsh-plugin`，无需重做；社交预览图 `docs/assets/session-graph-social-preview.png` 尚未通过 GitHub 设置界面配置，此前浏览器连接未成功。
- 已应用 `dsh-plugin-dev`、`codebase-design`，并阅读兼容性分析伴随技能。没有调用多代理。当前任务不需要给 upstream 发帖、评论或消息。

### 用户回来后的下一步

1. 读本文件和 `AGENTS.md`，检查工作区；保存这份尚未提交的交接及两条本地提交。不要 reset、清理 artifacts 或覆盖既有改动。
2. 以 A–H 为基础完成可执行的 Issue 正文；把下文历史 Merge 迁移等已知阻塞纳入兼容性拆分，必要时增加独立子 Issue。尚未决定的旧版支持政策与 URL/渠道方案应如实写成待验证设计，不能声称用户已经选定。
3. 用 `gh` 重新读取现有 Issues 防止重复，然后创建总图和子 Issues。用户已授权创建。仓库要求标签 `wayfinder:map` / `wayfinder:task`；准备充分的任务用 `ready-for-agent`，其他分诊只用 `needs-triage`、`needs-info`、`ready-for-human`、`wontfix`。本轮未创建标签。
4. 使用原生 sub-issues 和阻塞依赖。已查官方 REST：`POST /repos/{owner}/{repo}/issues/{number}/sub_issues` body 为 `sub_issue_id`（数据库 ID）；`POST .../dependencies/blocked_by` body 为 `issue_id`。不可用时采用总图 task list、子单 `Part of #N` / `Blocked by: #N`。
5. Issue 正文使用文件加 `--body-file`，保留实际换行；public body 中使用仓库相对路径和固定提交源码链接，不复制本机绝对路径或认证信息。发布后读回正文、标签、父子和依赖，更新总图 frontier，再将真实链接写回本文件并给用户结果。
6. 本次关机暂停前不执行以上创建和实施；用户回来后按其最新指令继续。

## Resume snapshot

- Repository: [`benz-ai-x/dsh-session-graph`](https://github.com/benz-ai-x/dsh-session-graph)
- Package: [`@benz-ai-x/dsh-client-ui-session-graph`](https://www.npmjs.com/package/@benz-ai-x/dsh-client-ui-session-graph)
- Checkout: `/Users/pc2026/Dev-Space/dsh-session-graph`
- Branch: `main`, HEAD `b533c933eb24d531fe3135c785db7b813c59fb5c`; two commits ahead of the locally recorded `origin/main`. Preserve those commits; no fetch, reset, commit, push, or release was performed during this work.
- Package version: `0.1.6`. Last recorded release: [`v0.1.6`](https://github.com/benz-ai-x/dsh-session-graph/releases/tag/v0.1.6), commit `cb48647`; the plugin's current npm dist-tags were not rechecked on September 9.
- Target Harness checkout: `/Users/pc2026/Dev-Space/deepseek-harness`, clean `master`, official tag `dsh-v0.1.5-alpha.1`, commit `5dda764ed3aa172535a7967b06ff95d9cbfe536a`. The checkout has no root `.env` and already has dependencies and built output.
- Local tools: Node `26.4.0`, pnpm `11.7.0`.
- Scope: this handoff belongs to `dsh-session-graph`, not the separate `dsh-graph-workflow` repository.
- Current task: paused after development analysis for the seven-requirement roadmap; actual GitHub Issues are still to be created. An earlier authorized Harness `0.1.5-alpha.1` adaptation audit is preserved below; implementation has **not started**. The latest shutdown instruction takes precedence over the implementation checklist below.

## Earlier compatibility task: user intent and audit pause point

The user first requested a compatibility audit against the local latest Harness, then said: “要怎么改？ 我希望支持最新的版本” (“How should it change? I want support for the latest version”). Adaptation work is authorized. They subsequently interrupted the investigation with “写交接文档，我等下再处理” (“Write a handoff; I will handle it later”). Stop after this handoff and resume implementation only when the user returns.

An optional question about retaining support for Harness `0.1.2-alpha.1`–`alpha.3` was sent but **not answered**. The proposed new baseline is `0.1.5-alpha.1`; dropping old-version support is not an accepted decision. No business source, manifest, lockfile, CI, README, or test source has been changed. No actual user sessions or live profiles were read, migrated, or modified, and no real model calls were made.

`gh issue list --repo benz-ai-x/dsh-session-graph --state open --json number,title,body,labels` returned no open issues. No issue or PR was created. The local `dsh-plugin-dev` skill was used; its pinned rc.1/historical contracts do not establish compatibility with this target. Follow the exact target source and the audit evidence. This project has no `dsh-reference.lock.json`, `docs/agent/PROJECT_CONTRACT.md`, `TODO.md`, or `context:check` script.

## Confirmed incompatibilities

| Surface | Failure and source | Required work |
| --- | --- | --- |
| Merge submission | `src/session-merge-harness.ts:101` spreads `agent.session.events`. The current Session class removed that getter; a real Session produces `agent.session.events is not iterable`, wrapped as `target-resolution-failed`. | Use the current immutable `snapshotEvents()` API; update the local adapter type and test with a real Session. This change was already present in Harness `0.1.2-alpha.4`. |
| Session Digest | `src/index.ts:192` calls `ctx.sessionPersistence.inspect()`, removed by the handle-based persistence change in Harness `0.1.3-alpha.1`. A real JSONL service with a readable nonblank V3 session reproduces `inspect is not a function` before model invocation. | Select and implement the read seam: `SessionController.inspect()` still supports attached/cold sessions, or use `SessionPersistence.open(id, 'read', { signal })` plus handle `read()` and guaranteed `close()`. Adjust declared injections and preserve cancellation, read-only behavior, and freshness for running sessions. No choice has been implemented. |
| Historical Merge sessions | `src/session-merge-host.ts:276` creates a `user/message` whose `source.kind` is `session-graph-merge`. Harness `packages/session/session-format-v2-to-v3/src/payload.ts:110` rejects this source as unclassified. | Decide an explicit historical-data migration route. Isolated tests through the complete official catalog confirmed that old V0, V1, and V2 artifacts containing this marker fail, while ordinary-message controls migrate successfully. Changing future writes alone cannot repair existing logs. |

The historical failure rejects loading the affected session, not merely displaying its Merge edges. The audit did not establish whether the user has affected sessions. Native V3 encoding accepts this custom message source; do not confuse historical migration admission with current-format admission.

The latest upstream investigation established a material constraint: `packages/session/session-format-catalog/src/generated.ts` statically imports the first-party migration chain. Its README explicitly states “external migration ownership and distribution are not supported”; feature plugins cannot register or reorder migrations at runtime. A transparent plugin-only migration hook is therefore unavailable. An upstream compatibility change or a separately designed, validated offline migration may be needed. Neither has been selected or implemented. Preserve existing generations and their bytes; do not overwrite, delete, or casually rewrite old user logs. Revisit the historical-compatibility assumption in `docs/adr/0003-record-merges-as-independent-session-projections.md` when deciding the durable approach.

The release's removal of `ctx.agent` and the runtime `Inbox` class does not directly affect this plugin: it does not call those removed APIs. The `agent.inject()` / `agent.steer()` methods it uses still exist. The consumed Session list fields, `conversation.view` slot, and browser shared-module protocol remain available; the existing frontend tests pass.

## Dependency and verification gaps

- `package.json:102` pins `@deepseek-ai/dsh-llm` to `0.1.2-rc.1`; commit `11a9702` added that peer after the last recorded release. Installation resolves the old LLM/Typert packages and two Schemastery versions.
- `pnpm run check` currently fails during type checking. `types/deepseek-harness.d.ts` shadows real Harness modules and conflicts with installed LLM/Context declarations; the LLM declaration graph lacks `dsh-attachment`, and duplicate Schemastery declarations also fail. These are current-repository dependency/type issues, not all newly introduced by Harness `0.1.5-alpha.1`.
- The built Host imports `@deepseek-ai/dsh-typert-protocol` directly without declaring it. Ordinary Node import of `./lib/index.js` fails with `ERR_MODULE_NOT_FOUND`. This was tested outside a Harness profile; a profile's fallback resolution was not tested and must not be presumed to fail identically.
- Registry reads confirmed that `@deepseek-ai/dsh-llm@0.1.5-alpha.1` and `@deepseek-ai/dsh-typert-protocol@0.1.5-alpha.1` are published; both declare Cordis `^4.0.2`. LLM depends on Schemastery `^3.18.2`; its public declarations reference attachment types. No updated dependencies have been installed yet.
- Resolve direct runtime dependencies and real type declarations together. If using full upstream types, investigate separate Host and Client compiler faces because their Cordis `Context.sessions` services differ. Do not just silence the existing errors or let standalone stubs remain the only compatibility evidence. This architecture choice remains open.
- `tests/host.harness.spec.ts:288` reads `target.events`; lines 290/297 use `cachedSnapshot(header)` and line 306 uses `coldSnapshot(header, events)`. Current cache signatures are `cachedSnapshot(header, inheritedEventCount, keys?)` and `coldSnapshot(header, inheritedEventCount, events)`.
- Existing digest tests mock the removed `sessionPersistence.inspect`; Merge tests mock Sessions with the removed `events` property. Those passing tests conceal the two product failures. Add regression coverage using real current services and Session objects.
- `.github/workflows/ci.yml` and both READMEs still claim only Harness `0.1.2-alpha.1`–`alpha.3`. Update the supported/tested matrix after settling the version scope and completing validation.

## Current verification evidence

| Check on September 9 | Result |
| --- | --- |
| Dependency installation and its prepare build | Build passed; ignored `node_modules/` and `lib/` were populated/refreshed. |
| `pnpm run check` | Failed at `tsc --noEmit`; its subsequent test step did not run. |
| Standalone `pnpm exec vitest run` | 18 files, 167/167 tests passed. |
| Original `DSH_HARNESS_ROOT=/Users/pc2026/Dev-Space/deepseek-harness pnpm test:harness` | 96/97 passed: 87 frontend tests passed; the cache restoration Host test failed first on missing `inheritedEventCount`. |
| Temporary updated test fixtures plus isolated probes | 3 files, 104/104 passed: 97 existing tests with temporary fixture conversion plus 7 probes. The probes assert the known failures; this does **not** mean the product was fixed. |
| Ordinary Node import of built Host | Failed: missing directly resolvable `@deepseek-ai/dsh-typert-protocol`. |
| Browser/profile/packed-artifact end-to-end acceptance | Not performed for this target. |

Local disposable evidence is in `.artifacts/compat-20260909/`: `report.md`, `probe.spec.ts`, `vitest.config.ts`, `harness.log`, `standalone.json`, and `standalone.log`. These are ignored outputs, not another handoff or committed tests; essential findings are recorded above so a clean checkout does not depend on them. The probe runner uses the real Harness source resolver and changes only the old test fixture expressions in memory:

```sh
DSH_HARNESS_ROOT=/Users/pc2026/Dev-Space/deepseek-harness pnpm exec vitest run --config .artifacts/compat-20260909/vitest.config.ts
```

The seven probes cover real JSONL digest failure, real Session Merge-target failure, V2-to-V3 marker rejection, native V3 marker encoding, and full V0/V1/V2-to-V3 rejection with successful ordinary-message controls. Convert suitable probes into assertions of the intended behavior when implementing fixes; do not leave tests asserting known breakage as acceptance tests.

## Compatibility implementation checklist (preserved for the roadmap)

1. Read `AGENTS.md`, this file, `CONTEXT.md`, and relevant ADRs. Recheck both worktrees and the target Harness commit. Preserve `main`'s existing two local commits.
2. Resume the authorized latest-version adaptation. Keep the unanswered old-version-support preference visible; do not report it as decided. Follow `docs/agents/issue-tracker.md` if tracking work externally; no ticket currently exists for this task.
3. Fix the Session read APIs and add regressions using the real Host/Session stack. Preserve digest cancellation and disposal, Merge authority checks, retries, snapshot capture, and its durability barrier.
4. Resolve dependency declarations, public type conflicts, and ordinary built-entry loading. Keep Host/Client type boundaries explicit if replacing the ambient stubs. Avoid broad unrelated refactoring.
5. Settle historical Merge migration separately against the static-catalog restriction. Prove ordinary history, affected Merge history, preserved source generations, and native V3 behavior in isolated fixtures. Do not run a migration on the user's real data as part of routine validation.
6. Update current cache fixtures, the agreed CI matrix, both READMEs, and any affected durable decision. Do not claim complete historical compatibility without the migration evidence.
7. Run `pnpm run check`, the target Harness suite, actual Loader/profile tests, and packed-artifact add/load/remove smoke with an isolated temporary `DSH_HOME`. A build or mocked UI pass does not prove the deployed Host path. Check required Harness artifacts are current before using built paths.
8. Update this root handoff with actual outcomes and remaining limits. No publication was requested; if later releasing, update `package.json` before tagging `v<version>` and keep the build-generated Graph badge in sync.

## Previous completed releases

The Harness `0.1.2-alpha.3` compatibility audit (2026-09-01) found no product-code incompatibility: every plugin-consumed API changed only additively (`ISession.loadThrough`, `PendingSubmission.placement`, conversation `openView`/`selectView` injections — none implemented or called by this plugin). The alpha.3 breakage was confined to the `tests/views.client.spec.tsx` bench, which hand-mounts the real Conversation skeleton and lacked the newly injected view-selection callbacks; the bench now supplies `selectView`/`openView` store-action twins that remain harmless extra props on alpha.1/alpha.2. Release `v0.1.6` (commit `cb48647`, no runtime change) carries the audit outcome: the CI harness matrix, both READMEs' CI paragraphs, and the release compatibility table all cover `dsh-v0.1.2-alpha.3`.

Release `v0.1.5` fixes Host startup against DeepSeek Harness `0.1.2-alpha.2` while retaining `0.1.2-alpha.1` compatibility. The cause, implementation, regression coverage, version bump, bilingual documentation, and CI matrix are all captured in commit [`bb94fb2`](https://github.com/benz-ai-x/dsh-session-graph/commit/bb94fb25fcda5680ec71f5f9600bf89b61e295fc); do not reconstruct them in this document.

On September 1 the local `web` profile was observed on `127.0.0.1:3080`; its current status was not checked. Access requires the authenticated URL printed by `dsh web`; never copy its token into documentation or shared logs.

## Documentation consolidation

The documentation consolidation requested after `v0.1.5` is complete and intentionally separate from the release commit:

- this root `HANDOFF.md` is the canonical handoff;
- the tracked legacy `session-graph-handover.md` is deleted;
- `docs/HANDOFF.md` is marked as historical;
- `AGENTS.md` records the canonical-file rule;
- `README.md` and `README.zh.md` present the same quick start, compatibility, data/model behavior, troubleshooting, and contributor guidance.

Do not restore `session-graph-handover.md` or create another live handoff file.

## Authoritative references

- Repository and release rules: [`AGENTS.md`](AGENTS.md)
- Domain terminology and boundaries: [`CONTEXT.md`](CONTEXT.md)
- Durable decisions: [`docs/adr/`](docs/adr/)
- Historical project snapshot: [`docs/HANDOFF.md`](docs/HANDOFF.md)
- Issue workflow: [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md)
- Previous alpha.2 runtime compatibility fix: [`bb94fb2`](https://github.com/benz-ai-x/dsh-session-graph/commit/bb94fb25fcda5680ec71f5f9600bf89b61e295fc)
- Current target release: [Harness `0.1.5-alpha.1`](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.5-alpha.1)
- Runtime-hardening review: [PR #2](https://github.com/benz-ai-x/dsh-session-graph/pull/2)

## Historical verification record (September 1)

- Local package check: 18 files, 167 tests passed.
- Local Harness integration, 2026-09-01: `0.1.2-alpha.1`, `0.1.2-alpha.2`, and `0.1.2-alpha.3` checkouts each pass 2 files, 97 tests (the alpha.3 leg required the bench fix above; alpha.1/alpha.2 were re-run to prove the fix stays backward compatible).
- CI passed Node 22.19/24/26 plus Harness `alpha.1`, `alpha.2`, and `alpha.3` on the matrix commit: [run 33459461048](https://github.com/benz-ai-x/dsh-session-graph/actions/runs/33459461048).
- Trusted Publishing and npm provenance for `v0.1.6` completed successfully: [run 33459622859](https://github.com/benz-ai-x/dsh-session-graph/actions/runs/33459622859); npm `latest` is `0.1.6`.
- Both public READMEs pass relative-link checks and render through GitHub's GFM API; the post-update package check still passes 167 tests.

## Suggested skills

- `dsh-plugin-dev` for Cordis lifecycle, Remote compatibility, Harness integration, packaging, or releases.
- `diagnosing-bugs` for runtime, lifecycle, cancellation, persistence, or performance failures.
- `code-review` before approving or releasing subsequent implementation changes.
- `domain-modeling` when changing Session Graph terminology, projections, lineage, or ADR-backed boundaries.
