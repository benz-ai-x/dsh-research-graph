# 开发与发布

[项目概览](../README.zh.md) · [English](development.md) · [使用指南](user-guide.zh.md)

以下命令均在仓库根目录执行。

## 开发与贡献

环境要求为 Node.js `^22.19.0 || >=24.0.0` 与 pnpm `11.7.0`。

接手时先读 [AGENTS.md](../AGENTS.md) 的开发规则、[CONTEXT.md](../CONTEXT.md) 的领域词汇，以及根 [HANDOFF.md](../HANDOFF.md) 的当前状态和本地工作树。[文档分工表](agents/domain.md#documentation-map) 区分实时状态、长期决策与版本验收；`docs/HANDOFF.md` 仅为历史快照。

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

修改 Session、Merge、Digest 或持久化行为前，请先阅读 [`CONTEXT.md`](../CONTEXT.md) 的领域模型与 [`docs/adr/`](adr) 的持久设计决策。安装方式或产品行为变化时，同步更新对应指南的中英文版本；产品定位或快速开始信息变化时，再同步更新两个 README。面向用户的工作应从 [GitHub Issue](https://github.com/benz-ai-x/dsh-research-graph/issues) 开始。

`check:harness` 要求宿主版本与 `package.json` 中 `peerDependencies["@deepseek-ai/dsh-llm"]` 固定的目标版本一致。它用该 checkout 构建的真实公开声明检查四个编译面：Host／Client 源码与 Host／Client 打包声明，不加载独立测试用的宿主声明替身；随后运行真实 Session、持久化、历史恢复与 UI 集成测试。CI 在 Node.js 22.19、24 与 26 上运行独立检查，并根据校验后的 DSH peer 依赖选择 `dsh-v<dsh-version>`，不受插件修订号影响。打包验收在临时 `web` profile 中安装归档、启动真实 Host、验证 Merge 持久化及 Digest/History 只读行为，再移除插件。History 读取还经过与浏览器相同的 RPC Gateway，覆盖传输层提供的取消信号；仅模型传输使用固定响应。

使用以下命令构建可安装归档：

```sh
pnpm pack --pack-destination .artifacts
pnpm --dir /path/to/deepseek-harness run build:web
DSH_HARNESS_ROOT=/path/to/deepseek-harness pnpm smoke:harness
```

人工体验正式构建（要求目标 DSH 版本的 Harness 已完成 `build:native-system`、`build:lib`、`build:web`）：

```sh
DSH_HARNESS_ROOT=/path/to/deepseek-harness pnpm preview:dsh
pnpm preview:dsh --stop
```

启动器优先使用 `DSH_HARNESS_ROOT`。未设置或指定 checkout 不存在时，先在本仓库的相邻目录查找 `deepseek-harness-<目标 DSH 版本>`，再到上一级目录查找，因此也支持把插件工作树放入项目文件夹、Harness 留在外层的结构。找到的 checkout 若版本不匹配，会明确报错。

启动器打包并安装常规插件，在 `.artifacts/workbench-dsh/profile/` 中运行独立 DSH，打印本机访问地址并保留研究数据。示例包含 A / B 跨工作区讨论、知识卡片和后续研究；模型是明确标注的固定演示回答，不调用付费模型。停止后再启动会保留示例与人工操作，不影响已有 DSH profile。启动地址含本机登录凭据，不要发布原始日志或 `state.json`。

本地构建会根据 `package.json`、`tsdown.config.ts` 与 `src/` 下的全部文件生成稳定的 `local-<hash>` Build ID，其中也包括未跟踪或被忽略的文件。因此 Finder 元数据等本地额外文件可能改变 Build ID，而包版本不变。发布流水线可在构建时设置 `DSH_SESSION_GRAPH_BUILD_ID` 来替换它；核对发布时应比较具体归档与记录的构建输入。

### 发布

[Publish workflow](../.github/workflows/publish.yml) 接受已发布的 GitHub Release 或手工提供的现有 tag。它要求 tag 等于 `v` 加包版本，重新运行 `pnpm run check`，打包归档，并把这些已验证字节发布到 npm；稳定版使用 npm tag `latest`，预发布版使用 `next`。

本包使用 [npm trusted publisher](https://docs.npmjs.com/trusted-publishers/)：organization 为 `benz-ai-x`、repository 为 `dsh-research-graph`、workflow 为 `publish.yml`、environment 为 `npm-publish`，仅允许 `npm publish` action。工作流通过 GitHub OIDC 认证，不应再接收长期 `NPM_TOKEN`；保留 GitHub environment 作为发布边界。若为其他包名或 scope 做首次发布，只在首次引导时使用权限范围尽量小、有效期尽量短的令牌，随后立即配置 trusted publishing 并吊销该令牌。

首次适配 DSH 版本时，`package.json.version` 使用目标 DSH 的完整版本。同一 DSH 预发布版下的后续发布追加一个正整数修订号，如 `0.1.5-rc.2.1`、`0.1.5-rc.2.2`；所有直接 DSH 依赖仍固定为 `0.1.5-rc.2`。`@deepseek-ai/dsh-llm` 的精确 peer 依赖是兼容目标的唯一来源。插件 tag 为 `v<plugin-version>`，上游 tag 为 `dsh-v<dsh-version>`。`check-version.mjs` 拒绝无效修订号、依赖漂移及发布 tag 不一致，`--dsh-version` 输出校验后的目标供 CI 使用；`check:harness`、打包验收和预览启动器都使用这一目标。发布前完成 `pnpm run check`、`check:harness` 和打包 profile 验收，并确认 研图页头徽标读取同一版本，再合入变更、创建不可移动的 tag 和 Release。尚未发布的本地迭代使用 Build ID 区分，不覆盖已发布版本或重命名历史标签。

发布流水线会重新构建 tag。发布后应单独下载 npm 正式包，核对清单、版本／Build ID 和 registry 完整性，运行 `DSH_HARNESS_ROOT=/path/to/deepseek-harness pnpm smoke:harness /absolute/path/official.tgz`。将正式包与校验文件附到 GitHub Release 后重新下载比对；最终提交、运行记录、归档摘要与验收结果写入版本验收和根交接。

本包导出两个 Node 侧入口和一个惰性加载的浏览器模块；实际打包归档中的每个 JavaScript 入口都带有匹配的 TypeScript 声明：

| 导出 | 用途 |
|---|---|
| `.` | 研究主题、知识、分支／沿用、会话摘要与标题、原文／搜索及持久 Merge 提交的 Cordis Host services |
| `./invariant` | 运行时注册不变量 |
| `./client` | 构建后的 dsh 客户端模块 |
| `./cordis.patch.yml` | profile 组合包补丁 |

## 实现

`GraphView` 读取 Viewed Session、Workspace 成员关系、会话摘要与待处理交互映射。带索引的纯 helper 推导 Session Cluster、Branch 与 Merge 边、Subagent Summary、跨簇顺序、布局、吸附、Title Filter 匹配与视口状态；独立 presentation pipeline 再按顺序应用节点位置、折叠状态和簇偏移，再围绕最终卡片与可见簇标题路由，交给 `GraphCanvas` 渲染。Host 注册主题、知识、沿用、历史分支、搜索、原文、摘要、标题与汇聚等包自有服务；Merge 提交会重新校验 Host 权威状态、排入显式 marker 与规范引用，等待匹配投影，再写入 Projection Cache，之后才报告成功。

| 文件 | 职责 |
|---|---|
| [`src/research-topics-host.ts`](../src/research-topics-host.ts) | Host 存储、串行主题写入、轻量来源元数据与生命周期取消 |
| [`src/client/ResearchTopics.tsx`](../src/client/ResearchTopics.tsx) 与 [`src/client/TopicGraph.tsx`](../src/client/TopicGraph.tsx) | 主题创建、选择、引用、排列草稿与来源检查 |
| [`src/client/GraphView.tsx`](../src/client/GraphView.tsx) | Workspace/Directory Scope 解析、图谱推导与视图头部 |
| [`src/client/GraphCanvas.tsx`](../src/client/GraphCanvas.tsx) | 画布渲染、端子、检查器、控件、手势、悬停状态与 minimap |
| [`src/config.ts`](../src/config.ts) | 对外 Standard Schema、默认值与规范化 Host 配置 |
| [`src/index.ts`](../src/index.ts) | Host 服务与存储域注册、配置、生命周期和 Remote 错误 |
| [`src/knowledge-host.ts`](../src/knowledge-host.ts)、[`src/knowledge-extraction.ts`](../src/knowledge-extraction.ts)、[`src/knowledge-synthesis.ts`](../src/knowledge-synthesis.ts)、[`src/knowledge-export.ts`](../src/knowledge-export.ts) | 持久卡片修订与来源、审阅式生成、冻结引用和 Markdown 导出 |
| [`src/history-branch-host.ts`](../src/history-branch-host.ts) 与 [`src/research-reuse-host.ts`](../src/research-reuse-host.ts) | 可恢复的历史分支与冻结研究材料的确认提交 |
| [`src/session-digest.ts`](../src/session-digest.ts) 与 [`src/session-digest-harness.ts`](../src/session-digest-harness.ts) | 摘要输出校验、revision 缓存、并发控制与 Harness 路由重建 |
| [`src/session-merge.ts`](../src/session-merge.ts)、[`src/session-merge-host.ts`](../src/session-merge-host.ts) 与 [`src/session-merge-harness.ts`](../src/session-merge-harness.ts) | 浏览器流程、Host 校验、规范引用提交、有界捕获、幂等重试与持久性屏障 |
| [`src/session-merge-projection.ts`](../src/session-merge-projection.ts) | 版本化 Merge marker/reference 投影与严格持久状态校验 |
| [`src/session-history-host.ts`](../src/session-history-host.ts) 与 [`src/session-history-codec.ts`](../src/session-history-codec.ts) | 只读讨论分页、精确事件边界与共享的严格通信校验 |
| [`src/client/SessionHistory.tsx`](../src/client/SessionHistory.tsx) | 原文阅读、完成轮次选择、来源状态与请求取消 |
| [`src/session-title-host.ts`](../src/session-title-host.ts)、[`src/session-insight-source.ts`](../src/session-insight-source.ts)、[`src/session-insight-model.ts`](../src/session-insight-model.ts) | 只读标题建议及共享的限量讨论输入、模型调用 |
| [`src/client/session-digest-remote.ts`](../src/client/session-digest-remote.ts) | 严格的浏览器 Remote 请求/结果契约 |
| [`src/client/session-merge-remote.ts`](../src/client/session-merge-remote.ts) | 严格的浏览器 Session Merge Remote 请求/结果契约 |
| [`src/client/graph-model.ts`](../src/client/graph-model.ts) | 图谱范围、直接／继承汇聚来源、Branch 边、会话簇、子代理摘要、标题匹配与分支谱系 |
| [`src/client/knowledge-graph.ts`](../src/client/knowledge-graph.ts) 与 [`src/research-relations.ts`](../src/research-relations.ts) | 知识、来源与综合的图谱投影，以及已确认的材料沿用关系 |
| [`src/client/node-labels.ts`](../src/client/node-labels.ts)、[`src/client/SubagentDetails.tsx`](../src/client/SubagentDetails.tsx)、[`src/client/index.ts`](../src/client/index.ts) | 展示标题、同名短标识、委派任务检查，以及基于原生目录的子代理导航 |
| [`src/client/canvas-presentation.ts`](../src/client/canvas-presentation.ts) | 有序 Session Arrangement 投影以及最终/自动内容边界 |
| [`src/client/dependency-layout.ts`](../src/client/dependency-layout.ts)、[`src/client/layout.ts`](../src/client/layout.ts)、[`src/client/clusters.ts`](../src/client/clusters.ts) | 完整 Branch 簇的依赖排列、独立讨论集中布局、共享标题几何、折叠与偏移 |
| [`src/client/viewport.ts`](../src/client/viewport.ts)、[`src/client/preview-placement.ts`](../src/client/preview-placement.ts) 与 [`src/client/snap.ts`](../src/client/snap.ts) | 缩放、平移、尺寸保持、适应、minimap/预览定位与对齐参考线 |
| [`src/client/edge-routing.ts`](../src/client/edge-routing.ts) | 最终避障路由、关系端口、箭头、标签与完整路线边界 |
| [`src/client/layout-store.ts`](../src/client/layout-store.ts) | 按范围的 Session Arrangement 持久化、迁移与 fail-soft 存储恢复 |
| [`src/client/working-position.ts`](../src/client/working-position.ts) | 按 Host／范围隔离的视口、选择、阅读与搜索恢复 |
| [`scripts/resolve-harness.mjs`](../scripts/resolve-harness.mjs) 与 [`scripts/workbench/start.mjs`](../scripts/workbench/start.mjs) | 匹配 Harness 查找和保留数据的隔离演示 profile |
