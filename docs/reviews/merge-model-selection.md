# 汇聚模型选择与改名修复验收

- 日期：2026-10-12（Asia/Shanghai）
- Issue：[#64](https://github.com/benz-ai-x/dsh-research-graph/issues/64)
- 基线：main `3812e3c`（插件 0.2.1-alpha.2，DSH `dsh-v0.2.1-alpha.2` / `d743267`）

## 用户报告的两个问题与分析结论

1. **汇聚会话没响应**：预览真实浏览器流程复现，确认后失败于 `Merge Session … has no Client binding`。根因是 DSH 0.2.x 客户端 `sessions.create()` 只发布目录行、不再物化 Client binding，而插件 `renameTarget` 依赖 `ctx.sessions.binding(目标)`——目标已创建但从未改名、从未注入指令。该回归自 0.2.x 适配起存在：harness 视图测试桩恒返回 binding，实包冒烟走 fixture 的 Host 侧 `sessionController.rename`，都不经过真实客户端 binding。
2. **汇聚会话不能选择模型**：原链路从 UI 到 Host 没有任何模型参数，目标会话永远使用 Host 默认模型（`agentDefaultModel`）。捕获成功后模型调用的成败插件零感知；默认路由不可用或合并上下文超出所选模型容量时即表现为「没响应」。

## 变更内容

- **改名修复**：`renameTarget` 改走 `remote.session.rename`，不再依赖 binding 生命周期（与 fixture 的 Host 侧路径同构）。
- **模型选择**：
  - 应用层 `session-merge.ts`：`SessionMergeOptions` 增加可选 `model`；新增 `selectModel` 依赖，在 `complete()` 每次尝试（创建与重试）先于改名/提交调用，上游 `model/selection` 为追加式持久事件，重复应用无害；新错误码 `target-model-failed`（`creating` 阶段）与 `invalid-model-selection`（`validating` 阶段）。
  - 客户端装配：注入 `remote.session`，经 `selectModel` / `modelCatalog` 实现依赖与目录读取；三个汇聚入口（工作台 `mergeResearchSessions`、画布 `mergeSessions`/`retrySessionMerge`）请求类型均增加可选 `model`；standalone 编译面新增 `types/typert-session-remote.d.ts` 模块级增强与 `types/deepseek-harness.d.ts` 的 `session` remote 适配声明（harness 编译面用上游生成声明，四脸一致）。
  - UI：共享 `MergeModelSelect`（默认项「跟随 Host 默认模型（provider/model）」＝不调用 selectModel，行为与旧版完全一致；目录不可用时降级为仅默认项），接入工作台对话框与画布工具栏汇聚面板；工作台预览步骤显示本次将使用的模型。
- **边界核实**：上游 merge `submit` 的 `targetAcceptsSources` 只查 `turn/start` 与 marker，`model/selection` 事件不影响目标资格与投影捕获；重试路径重复 `selectModel` 安全。
- **应答可见性**：上游 ui-chat 的 `turn-error` 节点原生渲染 `turn/end reason.kind === 'error'`，已打开的汇聚会话对模型终态失败有原生呈现，本轮不新增插件内监控（结论记录于 Issue #64）。

## 验证

- `pnpm run check`：**235 项 / 25 文件**（新增应用层 5 例：selectModel 顺序/缺省/重试重应用/失败映射/空选择校验）。
- `DSH_HARNESS_ROOT=/Users/pc2026/DSH-Space/deepseek-harness pnpm run check:harness`：四个编译面匹配 + **352 项 / 23 文件**（新增工作台对话框 2 例：目录选择进请求、无目录面时降级默认；画布面板 1 例：选择模型后目标在提交前安装所选路由；rename 改经 remote 断言）。
- 预览手工场景（`pnpm preview:dsh`，固定演示模型）：
  1. 两个入口均出现「本次汇聚使用的模型」，默认项标注 `research-prototype/demo`，目录列出 Demo。
  2. 选定 Demo 后预览显示「This merge uses research-prototype/demo.」（英文界面，见截图一）。
  3. 确认后汇聚完成，目标会话正确命名「Merge: 方案 A：让响应更快 + 方案 B：让权限保持一致」并打开，模型给出回答（截图二）——修复前同一流程在改名一步失败。
- 截图：[preview-model.png](merge-model-selection/preview-model.png)、[merged-session-answer.png](merge-model-selection/merged-session-answer.png)。

## 未覆盖

- 未在真实供应商上验证大上下文汇聚（预览为固定演示模型）；上下文超预算仍按上游 `SESSION_REFERENCE_BUDGET_EXCEEDED` 呈现为可重试的快照提交失败。
- 未做 reasoning effort 选择（`selectModel` 接口留有扩展位），首轮跟随 provider 默认。
