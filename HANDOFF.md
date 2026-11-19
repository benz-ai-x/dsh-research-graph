# Research Graph Handoff

Updated: 2026-11-19 (Asia/Shanghai, 0.2.2-rc.5 适配 PR #104 已验收，待用户决定是否合并；最新发布仍为 0.2.2-rc.3.5)

根 `HANDOFF.md` 是唯一实时交接，不另维护历史快照。需求与进度以 GitHub Issues 为准，领域边界以 [CONTEXT.md](CONTEXT.md) 和 [ADR](docs/adr/) 为准；历史发布证据保留在 `docs/reviews/`。

## 当前状态

- **DSH 0.2.2-rc.5 适配（[PR #104](https://github.com/benz-ai-x/dsh-research-graph/pull/104)，本地已验收，尚未合并/发布）**：当前分支 `feat/dsh-0.2.2-rc.5`；官方 Harness checkout `/Users/pc2026/DSH-Space/deepseek-harness` 位于 `dsh-v0.2.2-rc.5` / `9c2670d3bce5275e0d1610272958121af87787bb`，干净重建 native/lib/web 后验收。插件版本、精确 LLM peer 和全部直接 DSH 依赖已钉到 `0.2.2-rc.5`；无产品运行时代码改动。新增真实 `LlmError CONTENT_REFUSED` Digest 回归，保持通用 `generation-failed`、不重试、不缓存失败、不改 Session 事件；接受 Host 搜索默认路由变化。vendored sidebar/workspace/default-workspace 源码 rc.3→rc.5 无差异，无需 port。完整矩阵见 [dsh-0.2.2-rc.5-compatibility.md](docs/reviews/dsh-0.2.2-rc.5-compatibility.md)。
- rc.5 独立门禁 **36 文件 / 302 项（不含 Harness specs）**、四编译面及完整 Harness **29 文件 / 389 项（含新增拒答回归）**全绿。候选 `.artifacts/benz-ai-x-dsh-research-graph-0.2.2-rc.5.tgz` 为 **788899 bytes**、SHA-256 `c696663fc9ebd26cd4e26fa7e3a65be2c36e5b89b202b5fb6b9fd3ca64547520`、Build ID `local-b7f7a7d4`；实包通过 19 次固定模型冒烟及第二 profile 恢复后 1 次，安装/移除干净。真实隔离浏览器核对同 Build ID 徽标、Workspace/Directory/Topic 图谱、知识/来源/原文阅读与 390px 侧栏开关；移除隔离 Workspace 后显示“当前目录”及同一 3 条讨论，随后以原生注册表按原路径恢复并重新挂载。另完成 Workspace Folder 创建（`rc5 复审文件夹 0`）与删除，未分组区保留，预览已停止。功能与验收 head `9eab1e125c62f1a440468fecdb16c392e0851b4d` 的 [PR CI 44447995513](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/44447995513) 中 Node 24、Node 26、Matching DSH release 全部通过。CI/Publish 的临时 `pnpm_config_minimum_release_age=0` 须在 **2026-11-19T13:20Z** 后按 PR #52 模式移除，并用无覆盖 frozen install 验证；不得遗留为长期配置。
- [Issue #100](https://github.com/benz-ai-x/dsh-research-graph/issues/100) 的提炼模型下拉已由 [PR #101](https://github.com/benz-ai-x/dsh-research-graph/pull/101) 合并为 `7260a3f62c638940f4013b37c316c2d2958ce123`，合并树与已验收 head `cf1913f742b58106ed745168bd993080ed2f68fa` 一致；合并后 [main CI 43856022521](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/43856022521) 全部通过。该阶段本地已切回 `main`；[PR #102](https://github.com/benz-ai-x/dsh-research-graph/pull/102) 的知识库 UIUX 优化已合并为 `2671df7d81879672f13d454177fb2f5c465ab806`，合并后 [main CI 43995458835](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/43995458835) 全部通过。
- **0.2.2-rc.3.5 已发布（2026-11-17，未部署）**：发布准备 [PR #103](https://github.com/benz-ai-x/dsh-research-graph/pull/103) CI 44012551296 通过后合并为 **`00c3adcdeb02afbb7c38ad7e0ba1f554f914991c`**，合并树与已验收 head `8cc834aaac47dc34ba4e481346fb7243066a7279` 一致，合并后 main CI 44013264813 通过。annotated tag `v0.2.2-rc.3.5` 指向该提交；[GitHub prerelease](https://github.com/benz-ai-x/dsh-research-graph/releases/tag/v0.2.2-rc.3.5) 已创建，OIDC [Publish 44013966671](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/44013966671) 成功，npm `next=0.2.2-rc.3.5`、`latest=0.2.2-rc.3.4` 未改。候选 **788885 bytes**、SHA-256 `df0e9ada05c66c14655f1c47147d16cbb836d209167abaee7674889f5a8df058`；正式包 **788455 bytes**、SHA-256 `60a93061293f80e571a3991fd42c056bf78b8a9d4657d10fb935d9a301539b57`、SHA-1 `f6f6c632f41c7dc80cc3fdc3f6d89afd9489557a`，两者不可混用。候选与官方字节分别通过 19 次固定模型冒烟及第二 profile 恢复后继续 1 次，Build ID 均为 `local-26a4949a`。integrity、SLSA subject/tag/commit/workflow/release 事件/invocation run 均核对通过，tlog 为 `3941611856`、`3941646371`；Release 归档与 SHA256SUMS 已上传、回读并 `cmp` 一致。私有证据 `.artifacts/release-0.2.2-rc.3.5/official/`；完整验收见 [release-0.2.2-rc.3.5.md](docs/reviews/release-0.2.2-rc.3.5.md)。
- 上一版发布基线为 `main@a723bba1659d1981ed2ee0cf427a86bda59a62fc`；[PR #97](https://github.com/benz-ai-x/dsh-research-graph/pull/97) 与 [PR #98](https://github.com/benz-ai-x/dsh-research-graph/pull/98) 已合并，功能与发布分支已清理。合并后 [main CI 43813450335](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/43813450335) 全部通过。
- 上一版发布为 **0.2.2-rc.3.4**，目标 DSH **0.2.2-rc.3**，npm **`latest=next=0.2.2-rc.3.4`**，官方 registry 与当前镜像回读一致，`@latest` 解析为新版本。[GitHub prerelease](https://github.com/benz-ai-x/dsh-research-graph/releases/tag/v0.2.2-rc.3.4) 与 OIDC [Publish 43814175804](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/43814175804) 已完成，透明日志 `3918786239`。未部署。
- 正式包 **779783 bytes**，SHA-256 `210927a441adfaac340a400a7169fa04d5ad686076a69b79877b3a92684eefb7`，Build ID `local-3525e2e8`。本地候选为 **780928 bytes**，SHA-256 `1b1fd4e2f0a8e36d702c41046d5fda2f2565fd08bc188c312d12863a8be0a5fe`，两者不可混用。正式包独立通过 19 次固定模型冒烟及第二 profile 恢复后继续 1 次，`npm audit signatures` 为 `invalid: []`、`missing: []`。
- 完整发布证据见 [release-0.2.2-rc.3.4.md](docs/reviews/release-0.2.2-rc.3.4.md)，功能验收见 [session-extraction-action.md](docs/reviews/session-extraction-action.md)。上一版发布证据保留在 [release-0.2.2-rc.3.3.md](docs/reviews/release-0.2.2-rc.3.3.md)。

## 当前工作树与证据

- 主工作树：`/Users/pc2026/DSH-Space/DSH-Research-Graph-Space/dsh-research-graph`。
- 原型工作树及本地/远端 `prototype/research-workbench` 分支已按用户要求移除；该分支 3 个独有提交已保存为 `.artifacts/prototype-cleanup/prototype-research-workbench.bundle`（`git bundle verify` 通过），原 `.artifacts/prototype-dsh` 资料另存于 `.artifacts/prototype-cleanup/prototype-artifacts/`，均未公开。
- rc.3.4 候选与正式 npm 验证证据分别保留在 `.artifacts/release-0.2.2-rc.3.4/candidate/` 与 `official/`，不要混用。rc.3.3 证据及预览 profile 保留在 `.artifacts/release-worktree-0.2.2-rc.3.3/`。
- Release 已上传正式归档和 `SHA256SUMS`，服务端摘要与官方包一致；初次 Release-CDN 下载超时后，覆盖失败的下载副本并逐字节复核通过。
- 既有 `.zcode/`、`docs/design/`、`docs/reports/`、研究文档和其他未跟踪资料未纳入发布，未修改。
- **知识库 UIUX 优化（[PR #102](https://github.com/benz-ai-x/dsh-research-graph/pull/102)，已随 0.2.2-rc.3.5 发布）**：功能提交 `c758e4d6a84702f25f7ec40ac576ebb8c824fe90`，最终合并为 `2671df7d81879672f13d454177fb2f5c465ab806`，与最新 main 的预期合并树一致；合并后 main CI 43995458835 通过，基于 `origin/main@0a3510c`，覆盖搜索提示、状态/类型筛选、最近保存/标题排序、SVG 图标与语义色徽章、来源按 Session 分组和摘录、主次操作、空后续区隐藏及宽窄屏布局；只改展示，不改卡片、修订、来源或 Host 记录。`pnpm run check` **36 文件 / 302 项**、完整 Harness **29 文件 / 387 项**与四编译面通过；最终品牌色修正后独立 302 项及知识库/阅读聚焦 **8 项**再次通过。真实隔离浏览器已检查宽屏与窄屏列表/详情切换、来源和警告区；预览与标签均已停止/关闭。实拍 `docs/reviews/assets/knowledge-library-uiux.png`，日常 profile 未改。两轴复审初轮 Spec 发现独立保存徽章缺失及导出不具备三级层级，Standards 另有枚举、长链和重复选择器简化建议；已补齐保存徽章、导出三级文本按钮，并新增 `knowledge-presentation.ts` 共享枚举和最新修订读取。修复后独立 **302 项**、Harness **387 项**及四编译面再次通过，原 Standards 与 Spec 审查员复核均 **通过、剩余问题为零**。

## 当前能力边界

- 会话 ZIP 同时包含完整已提交会话与上下文事件、子代理和附件；文件名包含实际工作区、会话标题、UTC 时间和短 ID。
- 恢复保留 Session ID、继承历史与附件，按所选工作区重定向 header cwd。内容一致者跳过，同 ID 冲突者拒绝覆盖；取消和失败明确报告部分恢复及失败 Session ID，不泄露 Host 路径。
- 备份不包含凭据、模型/插件配置、工作区定义与文件夹、研图 Topic/知识库/Branch Origin 数据、工作区文件、未提交 token 或 KV cache。
- **Selected Session 提炼入口（[Issue #96](https://github.com/benz-ai-x/dsh-research-graph/issues/96)，[PR #97](https://github.com/benz-ai-x/dsh-research-graph/pull/97)）**：Workspace/Directory 的“生成摘要”旁与 Topic 来源详情均可向前分页读取并实际选中当前 Selected Session 的全部已完成轮次；支持可选逐实体任务，生成中导航会先取消生成，复用审核保存流程。点击按钮本身不调用模型，不自动入库，不承诺逐实体完整性或事实核验。验收见 [session-extraction-action.md](docs/reviews/session-extraction-action.md)。
- 用户优先级：图谱使用体验第一，知识库归纳第二。[Issue #32](https://github.com/benz-ai-x/dsh-research-graph/issues/32) 的 P5 两项仍暂缓；新工作以用户下一条要求及 Issue 当前范围为准。

## 验证基线

- Issue #100 `pnpm run check`：**36 文件 / 302 项**；匹配 DSH `0.2.2-rc.3` 四编译面与完整 Harness：**28 文件 / 386 项**，均通过。上一版发布流水线证据见 rc.3.4 验收记录。
- 候选与正式 npm 包分别独立通过双 profile：原 profile 19 次固定模型调用；第二 profile 恢复后继续 1 次，安装/移除干净。
- Workspace/Topic 实际浏览器入口、原文实际勾选、三景点固定草稿编辑及所选 Topic 入库、390px 窄窗口已验收；真实模型逐景点质量未验收。预览已停止，日常 DSH profile 未修改，隔离演示 profile 保留。
- PR 初审发现的向前分页、原文选择及生成中导航缺陷已修复，并新增真实 Host 13 轮分页与三景点 Topic 入库回归。官方 npm 包独立验收及 Release 归档下载复核均已完成。
- Issue #100 模型目录下拉已验证缺失路由保留、提供方/模型联动和目录失败禁用；浏览器切换 `Demo alternate` 后生成请求显示 `research-prototype / demo-alt`。验收见 [extraction-model-select.md](docs/reviews/extraction-model-select.md)。
