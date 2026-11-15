# Research Graph Handoff

Updated: 2026-11-15 (Asia/Shanghai, 0.2.2-rc.3.3 已发布，未部署)

根 `HANDOFF.md` 是唯一实时交接，不另维护历史快照。需求与进度以 GitHub Issues 为准，领域边界以 [CONTEXT.md](CONTEXT.md) 和 [ADR](docs/adr/) 为准；历史发布证据保留在 `docs/reviews/`。

## 当前状态

- 当前分支为 `main`，`origin/main` 与本地一致；最近核对提交为 `525f3daa4589f850397bbedf3a21d5c91320bbcf`，[main CI 43726524298](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/43726524298) 全部通过，无开放 PR。
- 当前发布为 **0.2.2-rc.3.3**，目标 DSH **0.2.2-rc.3**，npm **`next=0.2.2-rc.3.3`**，`latest` 保持 `0.2.2-rc.3.2`。[GitHub prerelease](https://github.com/benz-ai-x/dsh-research-graph/releases/tag/v0.2.2-rc.3.3) 与 OIDC [Publish 43720788768](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/43720788768) 已完成，SLSA 透明日志 `3903385624` 核对通过。未部署。
- 正式包 **775309 bytes**，SHA-256 `baac709c33a62cf5b3f0c8d5eafbe171275f831ca98d1f3df36b6cd4fbd0752b`，Build ID `local-c699c66d`。本地候选为 **776112 bytes**，两者不可混用。正式包独立通过 19 次固定模型冒烟及第二 profile 恢复后继续 1 次，Release 归档与 SHA256SUMS 回读一致。
- 完整发布证据见 [release-0.2.2-rc.3.3.md](docs/reviews/release-0.2.2-rc.3.3.md)，功能验收见 [session-backup-restore.md](docs/reviews/session-backup-restore.md)。

## 当前工作树与证据

- 主工作树：`/Users/pc2026/DSH-Space/DSH-Research-Graph-Space/dsh-research-graph`。
- 未合并原型工作树：`/Users/pc2026/DSH-Space/DSH-Research-Graph-Space/dsh-research-graph-prototype`，分支 `prototype/research-workbench`，保留不动。
- rc.3.3 发布工作树及已合并功能/发布分支已清理。发布证据和预览 profile 已归档到 `.artifacts/release-worktree-0.2.2-rc.3.3/`（28 MB）。
- 正式 npm 验证证据另存于发布工作树归档内的 `release-0.2.2-rc.3.3/official/`；不要与本地候选归档混用。
- 既有 `.zcode/`、`docs/design/`、`docs/reports/`、研究文档和其他未跟踪资料未纳入清理，未修改。

## 当前能力边界

- 会话 ZIP 同时包含完整已提交会话与上下文事件、子代理和附件；文件名包含实际工作区、会话标题、UTC 时间和短 ID。
- 恢复保留 Session ID、继承历史与附件，按所选工作区重定向 header cwd。内容一致者跳过，同 ID 冲突者拒绝覆盖；取消和失败明确报告部分恢复及失败 Session ID，不泄露 Host 路径。
- 备份不包含凭据、模型/插件配置、工作区定义与文件夹、研图 Topic/知识库/Branch Origin 数据、工作区文件、未提交 token 或 KV cache。
- 用户优先级：图谱使用体验第一，知识库归纳第二。[Issue #32](https://github.com/benz-ai-x/dsh-research-graph/issues/32) 的 P5 两项仍暂缓；新工作以用户下一条要求及 Issue 当前范围为准。

## 验证基线

- `pnpm run check`：**36 文件 / 302 项**。
- 匹配 DSH `0.2.2-rc.3` 四编译面与完整 Harness：**28 文件 / 378 项**。
- 实包双 profile：原 profile 19 次固定模型调用；第二全新 profile 原生 ZIP 上传恢复零模型调用，恢复后继续 1 次且历史上下文进入请求，安装/移除干净。
- Standards / Spec 复核均无发现。预览已停止，日常 DSH profile 未修改。
