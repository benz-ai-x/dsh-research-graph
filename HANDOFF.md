# Research Graph Handoff

Updated: 2026-11-16 (Asia/Shanghai, 0.2.2-rc.3.4 已发布，未部署)

根 `HANDOFF.md` 是唯一实时交接，不另维护历史快照。需求与进度以 GitHub Issues 为准，领域边界以 [CONTEXT.md](CONTEXT.md) 和 [ADR](docs/adr/) 为准；历史发布证据保留在 `docs/reviews/`。

## 当前状态

- 发布基线为 `main@a723bba1659d1981ed2ee0cf427a86bda59a62fc`；[PR #97](https://github.com/benz-ai-x/dsh-research-graph/pull/97) 与 [PR #98](https://github.com/benz-ai-x/dsh-research-graph/pull/98) 已合并，功能与发布分支已清理。合并后 [main CI 43813450335](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/43813450335) 全部通过。
- 当前发布为 **0.2.2-rc.3.4**，目标 DSH **0.2.2-rc.3**，npm **`latest=next=0.2.2-rc.3.4`**，官方 registry 与当前镜像回读一致，`@latest` 解析为新版本。[GitHub prerelease](https://github.com/benz-ai-x/dsh-research-graph/releases/tag/v0.2.2-rc.3.4) 与 OIDC [Publish 43814175804](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/43814175804) 已完成，透明日志 `3918786239`。未部署。
- 正式包 **779783 bytes**，SHA-256 `210927a441adfaac340a400a7169fa04d5ad686076a69b79877b3a92684eefb7`，Build ID `local-3525e2e8`。本地候选为 **780928 bytes**，SHA-256 `1b1fd4e2f0a8e36d702c41046d5fda2f2565fd08bc188c312d12863a8be0a5fe`，两者不可混用。正式包独立通过 19 次固定模型冒烟及第二 profile 恢复后继续 1 次，`npm audit signatures` 为 `invalid: []`、`missing: []`。
- 完整发布证据见 [release-0.2.2-rc.3.4.md](docs/reviews/release-0.2.2-rc.3.4.md)，功能验收见 [session-extraction-action.md](docs/reviews/session-extraction-action.md)。上一版发布证据保留在 [release-0.2.2-rc.3.3.md](docs/reviews/release-0.2.2-rc.3.3.md)。

## 当前工作树与证据

- 主工作树：`/Users/pc2026/DSH-Space/DSH-Research-Graph-Space/dsh-research-graph`。
- 未合并原型工作树：`/Users/pc2026/DSH-Space/DSH-Research-Graph-Space/dsh-research-graph-prototype`，分支 `prototype/research-workbench`，保留不动。
- rc.3.4 候选与正式 npm 验证证据分别保留在 `.artifacts/release-0.2.2-rc.3.4/candidate/` 与 `official/`，不要混用。rc.3.3 证据及预览 profile 保留在 `.artifacts/release-worktree-0.2.2-rc.3.3/`。
- Release 已上传正式归档和 `SHA256SUMS`，服务端摘要与官方包一致；初次 Release-CDN 下载超时后，覆盖失败的下载副本并逐字节复核通过。
- 既有 `.zcode/`、`docs/design/`、`docs/reports/`、研究文档和其他未跟踪资料未纳入发布，未修改。
- **知识库 UIUX 优化（[PR #102](https://github.com/benz-ai-x/dsh-research-graph/pull/102)，已提交并推送，未合并）**：功能提交 `c758e4d6a84702f25f7ec40ac576ebb8c824fe90`，基于 `origin/main@0a3510c`，覆盖搜索提示、状态/类型筛选、最近保存/标题排序、SVG 图标与语义色徽章、来源按 Session 分组和摘录、主次操作、空后续区隐藏及宽窄屏布局；只改展示，不改卡片、修订、来源或 Host 记录。`pnpm run check` **36 文件 / 302 项**、完整 Harness **29 文件 / 387 项**与四编译面通过；最终品牌色修正后独立 302 项及知识库/阅读聚焦 **8 项**再次通过。真实隔离浏览器已检查宽屏与窄屏列表/详情切换、来源和警告区；预览与标签均已停止/关闭。实拍 `docs/reviews/assets/knowledge-library-uiux.png`，日常 profile 未改。两轴复审初轮 Spec 发现独立保存徽章缺失及导出不具备三级层级，Standards 另有枚举、长链和重复选择器简化建议；已补齐保存徽章、导出三级文本按钮，并新增 `knowledge-presentation.ts` 共享枚举和最新修订读取。修复后独立 **302 项**、Harness **387 项**及四编译面再次通过，原 Standards 与 Spec 审查员复核均 **通过、剩余问题为零**。

## 当前能力边界

- 会话 ZIP 同时包含完整已提交会话与上下文事件、子代理和附件；文件名包含实际工作区、会话标题、UTC 时间和短 ID。
- 恢复保留 Session ID、继承历史与附件，按所选工作区重定向 header cwd。内容一致者跳过，同 ID 冲突者拒绝覆盖；取消和失败明确报告部分恢复及失败 Session ID，不泄露 Host 路径。
- 备份不包含凭据、模型/插件配置、工作区定义与文件夹、研图 Topic/知识库/Branch Origin 数据、工作区文件、未提交 token 或 KV cache。
- **Selected Session 提炼入口（[Issue #96](https://github.com/benz-ai-x/dsh-research-graph/issues/96)，[PR #97](https://github.com/benz-ai-x/dsh-research-graph/pull/97)）**：Workspace/Directory 的“生成摘要”旁与 Topic 来源详情均可向前分页读取并实际选中当前 Selected Session 的全部已完成轮次；支持可选逐实体任务，生成中导航会先取消生成，复用审核保存流程。点击按钮本身不调用模型，不自动入库，不承诺逐实体完整性或事实核验。验收见 [session-extraction-action.md](docs/reviews/session-extraction-action.md)。
- 用户优先级：图谱使用体验第一，知识库归纳第二。[Issue #32](https://github.com/benz-ai-x/dsh-research-graph/issues/32) 的 P5 两项仍暂缓；新工作以用户下一条要求及 Issue 当前范围为准。

## 验证基线

- `pnpm run check`：**36 文件 / 302 项**；匹配 DSH `0.2.2-rc.3` 四编译面与完整 Harness：**28 文件 / 385 项**，候选与发布流水线均通过。
- 候选与正式 npm 包分别独立通过双 profile：原 profile 19 次固定模型调用；第二 profile 恢复后继续 1 次，安装/移除干净。
- Workspace/Topic 实际浏览器入口、原文实际勾选、三景点固定草稿编辑及所选 Topic 入库、390px 窄窗口已验收；真实模型逐景点质量未验收。预览已停止，日常 DSH profile 未修改，隔离演示 profile 保留。
- PR 初审发现的向前分页、原文选择及生成中导航缺陷已修复，并新增真实 Host 13 轮分页与三景点 Topic 入库回归。官方 npm 包独立验收及 Release 归档下载复核均已完成。
