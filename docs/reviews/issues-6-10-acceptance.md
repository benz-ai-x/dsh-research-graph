# Issues #6–#10：研究工作流批次验收

日期：2026-09-10。按 #6 → #7 → #8 → #9 → #10 顺序实现，集中完成完整检查、匹配 Harness、实际安装包冒烟、Chrome 操作及双轴代码审查。

后续 PR #17 独立审查发现的提交恢复、引用编辑和嵌套操作问题已修复；最新 Build、175／232 项测试、安装包及五张浏览器截图见[审查修复验收](pr-17-fixes.md)。以下保留原批次验收的版本与证据范围。

## 版本与环境

| 项目 | 本次记录 |
| --- | --- |
| 分支／基点 | `feat/issues-6-10-research-workflow`／`0c829e551d18d7b190120fedc820f28a346c9ed0` |
| 最终功能提交 | `39b84cf`；后续为测试 fixture、文档与截图 |
| 插件／Harness | `0.1.5-alpha.1`／`dsh-v0.1.5-alpha.1`，Harness `5dda764ed3aa172535a7967b06ff95d9cbfe536a` |
| Node／项目 pnpm | `26.4.0`／`11.7.0` |
| 浏览器 | 隔离的实际 Chrome `153.0.8010.36`，Playwright 驱动，1440×1080 与 960×900 |
| 最终浏览器 Build | `local-8f06cbdf` |
| 最终归档 | `benz-ai-x-dsh-client-ui-session-graph-0.1.5-alpha.1.tgz`，351,890 字节 |
| 归档 SHA-256 | `960a40f17e2b2a9f5911b41ae76194c7f000d6ab5e601171b6a977503b44a62f` |

所有操作针对临时 web profile、临时工作区和合成讨论。真实模型配置仅复制到该隔离 Host 中使用，没有改用户实际 profile、源会话或浏览器资料。认证地址和凭据不进入文档或截图。

第一轮浏览器功能路径使用 `local-394014a3`（`5d2399b`）。视觉检查发现窄窗口页头挤出、通用表单样式将复选框与文字纵排；`8df3cf4` 修正布局，`39b84cf` 再修复搜索层遮住卡片弹窗的问题。最终重新通过完整检查和 packed smoke，并通过原生 `plugin add` 安装最终归档后重启同一临时 Host。已逐字节核对安装后的浏览器模块与最终构建相同。旧路径的同名归档会被包管理器缓存，因此最终安装使用内容相同、文件名不同的归档，未把缓存命中当成升级成功。

## 自动检查与实际归档

| 检查 | 结果 |
| --- | --- |
| `pnpm run check` | 类型检查、构建及 18 文件／171 项 standalone 通过 |
| 匹配 `pnpm run check:harness` | Host/Client 源码、Published Host/Client 四个编译面全部通过；11 文件／222 项集成通过 |
| `pnpm pack --pack-destination .artifacts/issues-6-10` | 最终安装归档已生成 |
| 匹配 `pnpm smoke:harness <归档>` | 原生安装、启动、操作、卸载及临时 profile 清理通过；固定模型调用 10 次 |
| 真实模型定性样例 | 1 次真实提炼，5 张草稿；逐卡审核与修订见[模型效果记录](issues-6-10-model-quality.md) |

packed smoke 的真实 Gateway、Storage Domain、Session 和原生 Agent 路径覆盖：主题与人工卡片保存、提炼草稿返回、原生新讨论、固定预览、重复成功提交去重、Markdown 固定修订，以及既有 Merge、Digest、Original 和正文搜索。实际模型输入与预览首条用户消息精确相同，卡片原文没有被隐式展开，后续修订未进入旧消息；再次提交保持同一目标和单一原生 `rpcId`。提炼快照重启恢复在 `knowledge-extraction.harness.spec.ts` 验证；审核后保存与丢失响应重试在注册 UI、专门 Harness 测试及下述 Chrome 流程验证。

本地原始日志在忽略目录 `.artifacts/issues-6-10/`：`check-final.log`、`check-harness-final.log`、`pack-final.log`、`smoke-final.log`。它们是可重新生成的输出，不纳入提交。对应持久测试在 `tests/`，CI 从包版本选择相同 Harness tag。

PR #17 首次 CI 的三个 Node 检查及 Harness 四编译面通过，卡片搜索／来源关系界面用例在 Linux runner 超过默认 5 秒，另外 221 项通过。原因是该功能用例借用了规模 fixture 的 500 条主题引用。将其缩小到两条引用，保留全部行为断言、默认超时及独立的 1,000 引用验收后，同一本地用例由 3,327 ms 降至 180 ms；完整 standalone 171、Harness 222 项再次通过（`check-ci-fix.log`、`check-harness-ci-fix.log`）。两轴只读复核确认此调整保留规格覆盖。产品源码、最终归档和浏览器 Build 未改变。

## 浏览器操作与观察

### #6 可编辑、带来源的知识卡片

1. 在“缓存设计 — 方案 A”的 Graph → Original 选择 Turn 1，准确范围为事件 5–17，点击 Save as Knowledge Card。
2. 填写中文标题“缓存结论：先核对证据”、核心问题、结论、理由、待验证事项，选择 Method、Draft 和“缓存可靠性研究”。第一次保存时令隔离 Host 存储不可写；页面显示失败并保留各字段。
3. 恢复存储并重试。Host 中仅有一张卡、一个 Revision 1，没有重复保存。来源保留 Session 身份、目录、时间及同一轮次摘录。
4. 后续编辑保存 Revision 2，并明确选择 Confirmed；Revision 1 仍可选择，已使用的旧讨论不随之改变。Source 读取失败时显示 Excerpt only 与保留文本，恢复来源后可以重试。
5. 通过 Knowledge Cards 按正文“第二次修订”找到该卡；关闭并重开搜索后恢复关键词与搜索类型，并重新获得结果。Host 重启与浏览器 localStorage 清空后重新连接，卡片修订和主题成员仍存在。

### #7 提炼与逐卡审核

1. 对同一完整轮次预览实际纳入文本，确认提供方／模型，调用固定响应模型生成两张草稿。第二张包含越界引用，页面提示需核实，不能把无效边界当成来源。
2. 将第一张结论人工改为“人工审核：当前材料只支持保留原始证据和引用边界，不能证明缓存性能。”。
3. 点击 Append another draft batch，总共四张草稿，第一张人工编辑保持不变。只保存已审核的第一张到主题；其余未保存草稿未自动写入卡片库。
4. 另外经真实提供方完成固定三轮中文讨论的定性实验，5 张草稿均保留 draft 状态。引用有效但仍发现需收窄的措辞；原始结果与修订均附在[模型样例](issues-6-10-model-quality.json)，没有自动确认这些草稿。

### #8 从固定材料开始跨工作区讨论

1. 将人工卡 Revision 1 和单独选择的 Original Turn 1 加入材料池，输入新问题，明确选择另一个“验证工作区”。预览为 1,252／32,000 字符，分别显示卡片内容／来源说明和显式选择的原文。
2. 确认时在原生 Host 已接收后模拟响应丢失。页面保留问题、工作区、材料和同一预览，仍留在源 Session。
3. 重试后只新增一个目标 Session，打开目标原生 Chat。Materials used by this Session 显示已接收、两条沿用关系及与预览完全一致的内容。
4. 卡片随后追加 Revision 2；旧目标仍使用 Revision 1。Host 重启后从目标 Session 再读材料，全文仍与首次预览逐字一致。

### #9 工作位置与权威记录分离

1. 在主题中选中卡片、缩放到 69%、拖动卡片、填写标题筛选“先核对证据”。切换 Chat → Graph，明确打开 Research Topics 后，选中项、缩放、筛选、节点坐标及未保存排列均恢复；节点坐标偏差小于 1 px。
2. 显式 Save arrangement，刷新浏览器后重开该主题，继续恢复选中项、筛选和 69% 缩放。新 Viewed Session 最初使用自身范围图，不抢占宿主导航。
3. 最终归档安装后重启同一 Host，核对两张卡、三个修订、主题排列、原材料记录；再清空浏览器 localStorage 并重新认证，显式打开主题，仍能看到 Host 保存的排列与卡片。
4. 浏览器缓存恢复在同一 origin 的刷新／切换中验证。隔离 Host 重启使用新随机端口，后续验证的是 Host 权威数据恢复，不把跨 origin 浏览器缓存当成同步能力。

同目录不同 Workspace、Host 隔离、失效选中项清除、原文 anchor/scroll、损坏缓存、取消和迟到响应由确定性的注册 UI 集成验证；不声称在此次短浏览器流程中逐一重做了这些组合。

### #10 固定修订 Markdown 下载

1. 从主题 Export Markdown 选择两张卡中的一张。首次 prepareExport 模拟失败，选项保持；重试生成预览。
2. 实际 Chrome 下载 Revision 1 文件，1,920 字节，与 textarea 预览完全一致，未选卡片的标题／正文没有混入。
3. 保存 Revision 2、安装最终归档并重启后，再次选择同一卡预览及下载；1,926 字节，明确标记 Revision 2／Confirmed，与本次预览逐字一致。
4. Markdown 展示卡片字段、版本／时间、事件 5–17、已核对原文状态、保存摘录和来源关系清单。更新卡片不改变先前文件。保存后更新再预览、缺失／不完整来源、内嵌围栏、中文、空选择／不存在卡片、失败重试和固定下载由 Host／注册 UI 测试覆盖。并发准备、原文 changed 状态、50 张／8 MB 边界和取消分支做了实现审查，本次没有单独运行这些组合。

## 来源和模型计数

复用前后，三个来源的完整快照 hash 均相同。跨 Host 重启，三个来源各 20 条事件、共 60 条逐条相同；Harness 重建 metadata 时补充了 `delegationDepth: 0`，因此不声称跨重启完整快照 hash 相同。既有源会话没有新增用户／助手讨论、改变目录或归档状态。

| 来源 | 事件 SHA-256（重启前后相同） |
| --- | --- |
| 缓存设计 — 方案 A | `7dfc1b80d2537e1f5b7404ab894de3e3137f69d807845675a81415c9533dd5d8` |
| 缓存验证 — 跨工作区证据 | `a87dafdb127091c7d8751a835fa385e3b22a6925007c135c44b5fda8a32473b2` |
| 接口迁移 — 临时来源 | `20e577cb5c268f4fbd0bb29091a1efdf7e593ac70ce2130ad25c512789050491` |

浏览器 Host 的固定模型调用：初始化三个讨论及其标题共 6 次，两次提炼增至 8，原生新讨论与标题增至 10；重试未再增加。重启后读卡片、主题、材料、导出和搜索时计数为 0。真实模型定性实验单独为一次，不计入固定响应模型的计数。浏览器 `pageerror` 为 0。

## 双轴审查与修复

固定基点 `0c829e5` → `c6f28fd` 由两个独立 reviewer 分别完成 Standards／Spec 审查，随后逐项复核修复提交。

| 轴 | 初次发现 | 修复与复核 |
| --- | --- | --- |
| Standards | P2：保存来源首次读取遭遇传输失败时，没有立即显示保留摘录 | 读者从传入来源初始化摘录，失败不丢失；注册 UI 回归通过，原问题关闭 |
| Spec | P2：运行中切换 scope 携带旧主题局部排列；P2：失效原文恢复未清除主题选择 | 按完整 workingKey 重建主题视图，失效回调清除选择；两项注册 UI 回归通过，原问题关闭 |
| Spec 补充 | P3：尚在核对来源时提前显示“原文不可用” | 加载期间保留 excerpt 标记和文本，等待结果再显示缺失说明；复核关闭 |

实际归档还暴露并修复了 reuse 注入缺少 `sessionQuery`，最终 smoke 已走通该严格 Cordis 依赖路径。布局修复经实际截图复验；搜索 → 卡片 → 导出的新增遮挡问题通过隔离被覆盖视图的绘制层修复，返回时保留原卡片和搜索条件，已在最终安装包中复验。重跑完整检查和归档验收均通过。补充审查要求修正 README 的关系类型描述和验收记录的测试归属，均已修正并复核关闭；两轴无遗留发现。如需了解未发布分支状态，以关联 PR 的 head 和 CI 为准。

## 截图

| 截图 | Build | 内容 |
| --- | --- | --- |
| [卡片 Revision 1](../assets/issues-6-10/knowledge-card.png) | `local-394014a3` | 中文字段、类型／状态、保存来源 |
| [提炼审核](../assets/issues-6-10/extraction-review.png) | `local-394014a3` | 实际纳入范围、追加生成与保留人工编辑 |
| [复用预览](../assets/issues-6-10/reuse-preview.png) | `local-394014a3` | 完整发送文本及显式原文边界 |
| [丢失响应后重试](../assets/issues-6-10/reuse-retry.png) | `local-394014a3` | 错误提示与仍保留的同一预览 |
| [重启后的材料记录](../assets/issues-6-10/reuse-receipt.png) | `local-8f06cbdf` | 旧卡片修订和沿用关系 |
| [来源不可用时的摘录](../assets/issues-6-10/source-fallback.png) | `local-8f06cbdf` | Excerpt only、来源身份、重试和保存文本 |
| [Host 数据恢复](../assets/issues-6-10/topic-restored.png) | `local-8f06cbdf` | 保存的手动排列、两张卡、来源关系和 Revision 2 |
| [固定 Markdown 下载](../assets/issues-6-10/markdown-export.png) | `local-8f06cbdf` | 同行复选框、单卡选择、Revision 2 预览 |
| [窄窗口](../assets/issues-6-10/narrow-view.png) | `local-8f06cbdf` | 960×900 页头完整换行和画布 |
| [知识正文搜索](../assets/issues-6-10/knowledge-search.png) | `local-8f06cbdf` | 正文关键词查找保存的卡片 |
| [搜索打开卡片](../assets/issues-6-10/search-card-dialog.png) | `local-8f06cbdf` | 卡片正确显示在原搜索层上方 |
| [搜索打开卡片再导出](../assets/issues-6-10/search-export-dialog.png) | `local-8f06cbdf` | 导出覆盖卡片，关闭后逐层返回原状态 |

截图来自实际页面，已逐张视觉检查。手动排列允许重叠，恢复保留用户拖放位置。隔离 Chrome 和自有临时 Host 已退出，临时 profile、复制的凭据及认证状态文件已清除。此次未发布新版本、合并分支或升级用户实际 profile。
