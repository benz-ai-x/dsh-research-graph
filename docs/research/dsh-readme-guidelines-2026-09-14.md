# DSH README 规范核对（2026-09-14）

本记录核对 DSH Research Graph 对上游名称、插件安装和文档元数据的描述要求，为精简双语 README 提供依据。结论：**存在明确品牌规范和包文档规范，但上游仓库的 README 检查规则不等于第三方插件安装或市场收录条件。**

## 研究范围与版本

- 对用户指定的 `deepseek-harness` checkout 的 `docs/` 建立全量文件清单：375 个文件，其中 249 个 Markdown、122 个配对 YAML、4 张图片；全文检索 README、frontmatter、kind、description、bundle、发布、命名、市场、badge 和 topics 等概念，精读相关规范，并跟进它们引用的技能参考、模板、品牌规范及检查源码。未声称逐字审阅全部架构参考或图片。
- 上游 HEAD 为 [`c291e7961a515f6d7af9304e7fd1d257929aef26`](https://github.com/deepseek-ai/deepseek-harness/commit/c291e7961a515f6d7af9304e7fd1d257929aef26)，读取时 `git status --porcelain=v1` 为空。已用 GitHub API 核实该公开 commit；下列永久链接对应已提交来源，无本地未提交上游文档。
- 上游 HEAD 比 `dsh-v0.1.5-rc.2` 多 139 个提交，清单版本仍为 `0.1.5-rc.2`，不能据此声称插件兼容该开发 HEAD。已确认品牌指南、`docs/AGENTS.md`、元数据参考和插件发布教程与该标签内容一致。本次不重验产品兼容性；插件仍为 `0.1.5-rc.2.8`，精确 `@deepseek-ai/dsh-llm` peer 仍为 `0.1.5-rc.2`，权威为本仓库 [package.json](../../package.json)（核对时第 24、119 行）。

## 对外项目适用的规定

| 事项 | 上游原文的范围与强度 | 本项目应如何表达 |
| --- | --- | --- |
| 品牌关系 | 品牌规范允许在描述中真实、准确地说明与 DeepSeek Harness 的关系。[S1] | 首句保留 DeepSeek Harness 全称及上游链接，并明确本项目是 DSH Web 研究工作台插件。 |
| 项目名称 | 品牌规范**推荐**用 DSH 缩写命名，要求避免直接用完整 DeepSeek Harness 作项目名。[S1] | 保留 `DSH Research Graph · 研图`，无需改为含完整上游名称的项目名。 |
| 官方归属 | 品牌规范要求避免通过展示或官方素材造成官方背书、合作、授权的误解。[S1] | 可用“第三方插件”或“independently maintained plugin”说明维护关系；不宣传为官方产品或认证插件。该措辞是本次编辑建议，并非规定的固定免责声明。 |
| 安装格式 | 用户开发教程区分 npm bundle 与可启动 profile。包声明 `dsh.bundle.patch` 才会自动激活配置层；缺少声明时仅作为普通依赖安装并警告。[S2] | 本仓库 [package.json](../../package.json) 第 78–95 行声明 bundle 和 Web client，因此可以写“通过 `dsh plugin --profile web add …` 安装到 DSH Web”。 |
| 安装前提 | CLI 参考明确要求 PATH 中可执行 `pnpm`，实现直接启动 pnpm 并在缺失时返回错误。[S12] | 快速开始注明需要匹配的 DSH 和可用的 pnpm，避免让读者误以为 DSH 内置了插件安装用的 pnpm。 |
| 启动入口 | 架构文档明确 `dsh web` 是 `--profile web` 的别名，支持的 Node 应用通过 DSH profile 启动。[S3] | 保留当前安装和 `dsh web` 两行命令，说明需先有匹配 DSH，不写独立启动应用或导入 SDK 的用法。 |
| 发布方式 | npm 预构建包和 `pnpm pack` tarball 都是官方教程支持的分发方式；从 GitHub 安装源码有额外 prepare/allowBuilds 条件。[S2] | README 优先保留精确 npm 版本安装，归档和开发安装留给指南；不把 GitHub 源码安装当成已验证的捷径。 |
| npm 命名 | `@deepseek-ai/dsh-<name>` 的工作区规范出现在“adding a workspace package”教程；对外插件教程示例直接使用 `dsh-hello-plugin`。[S2][S4] | 保留维护者自己的 `@benz-ai-x/dsh-research-graph`，不套用上游工作区 scope。未找到要求所有第三方包采用上游 scope 的规范。 |
| GitHub Topic | 上游根 README 推荐插件仓库添加 `dsh-plugin` topic，以方便发现。[S11] | 在仓库 Topics 核对这一项；它是明确的生态推荐，未被表述为安装或市场准入条件。 |

## README 元数据与文档规则

上游 `dsh-doc` 元数据参考明确要求 authored README 从 YAML frontmatter 开始，包 README 双语都包含非空 `description` 与 `kind`。`description` 用一两句写明内容、适用读者任务和可检索领域词；不堆砌宣传、历史或代码清单。`dsh.bundle.patch` 对应 `kind: package-bundle`，而非按项目是否使用 React 或提供 Host 服务分类。[S5]

这是实际存在的规则，不能简单称为“无用途的 YAML”。但其机械检查只扫描 Harness 自身 `packages/**/README.md` / `README.zh.md`；它既没有扫描外部仓库，也不是 `dsh plugin add` 的 README 校验器。检查源码还拒绝重复或无消费者的 `name`、`audience`、`tags`、`i18n` 元数据。[S6]

**建议本项目自主采用 `description` + `kind: package-bundle` 两个字段。** 这样与上游的 Agent 检索和文档分类约定一致；不宣称 YAML 会直接提升 GitHub 搜索排名，也不宣称已完整采用所有上游包模板。包能否安装启用仍由 manifest 决定。[S2][S5][S6]

```yaml
---
description: "DSH Web research workbench plugin for organizing conversations, tracing sources, and reusing reviewed knowledge. Covers capabilities, compatibility, and installation."
kind: package-bundle
---
```

中文 counterpart 翻译 `description`，保持相同 `kind`。该例用于描述文档用途，不代替正文中的用户价值说明。[S5]

| 上游仓库内部规则 | 已核实的证据 | 本项目采用建议 |
| --- | --- | --- |
| 包 README 用 Summary、目录、Dev Note 模板；完整 Model Experience 和限制章节还有独立检查 | 模板说明安装层、实现折叠和相邻文档；结构检查范围仍是 Harness 的 package README，两个专项检查也只枚举 `packages/*/*/package.json`。[S6][S7] | 用户已要求精简，且本项目 [文档分工](../agents/domain.md#documentation-map) 将详细行为放在指南；不整套搬入这些标题。保留能力图谱、可见截图、六项能力、必要信息与快速开始。 |
| 每个事实有一个归属文档；描述当前行为，详细内容链接到所有者 | `docs/AGENTS.md` 的文档分层、写作与链接规则。[S8] | README 不恢复发布流水账、测试计数或机器路径；模型调用和数据边界用简短表格，详细解释链接到双语指南。 |
| 双语地位相同、同级文件、结构和语义一致；上游另有逐行、sidecar 与工具检查 | `docs/i18n/README.md` 明确以“This repo”定义范围；metadata 参考要求逐行和 frontmatter 键顺序一致。[S9][S5] | 本项目继续同轮更新中英文，检查链接、代码块和语义。无需仅为本轮 README 优化新增未被本仓库工具消费的 `.i18n.yaml`，也不宣称通过上游配对检查。 |
| README 不是其他包实现细节的副本 | `docs/AGENTS.md:29` 和 adding-a-package 的 README 章节要求每包只解释自身责任。[S4][S8] | 将模型和 Agent 执行归属 DSH，将研究主题、知识修订和材料沿用归属本插件；不把 Agent 预设或 Agent Team 作为插件现有能力。 |

## 市场、徽章与 SEO 的证据边界

在此次全量 `docs/` 文本检索及被引用的元数据、模板、品牌规范中，**未发现**面向第三方插件的市场收录清单、README 必填关键词、强制 GitHub topics 集合或强制 badge 条款。上游根 README **明确推荐添加 `dsh-plugin` topic**，应与“没有强制条款”分开说明。[S11] 此为已检查来源范围内的结论，不表示其他站点或将来版本不存在其他规则。

Cordis 教程页确实使用 `powered_by-dsh` badge；这是可参考的使用实例，不是强制要求或认证标识。[S10] 现有 CI、npm、MIT 徽章可以保留；是否另加 DSH 兼容徽章属于展示选择。README frontmatter 的 `description`、npm `package.json.description` 和 GitHub 仓库 About 是不同载体，本次不应把修改前者称为已同步后两者。[S5][S6]

## 本项目的采用方式

双语 README 使用简短的 `description` 与 `kind: package-bundle`，首句说明由社区独立维护、运行于 DSH Web；保留能力图谱、直接显示的功能截图、关键能力与必要信息。安装前提明确匹配的 DSH 和 pnpm；`npx` 与源码入口留在双语使用指南。仓库 Topics 已包含上游推荐的 `dsh-plugin`，本轮无需添加。[S1][S5][S11][S12]

本项目采用上述适用约定，继续使用自身文档检查，不宣称通过上游整套包 README、逐行配对或市场审核。产品版本、兼容目标、包清单和运行行为没有因本次文档调整而改变。

## 逐项主源

- **[S1]** [`BRAND_GUIDELINES.md:5–10`](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/BRAND_GUIDELINES.md#L5-L10)：对外品牌关系、DSH 命名推荐与避免误导；由 [`docs/i18n/README.md:44`](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/docs/i18n/README.md#L44) 跟进到根文档。
- **[S2]** [`docs/user/develop/basic/publish.md:9–16,33–64,75–110,153–178`](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/docs/user/develop/basic/publish.md#L9-L178)：外部 bundle/profile 定义、manifest、安装移除和分发方式。
- **[S3]** [`docs/architecture.md:11–27,41–43`](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/docs/architecture.md#L11-L43)：DSH 插件组合与支持的 profile 启动入口。
- **[S4]** [`docs/cookbook/adding-a-package.md:1–5,70–106`](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/docs/cookbook/adding-a-package.md#L1-L106)：上游工作区包范围、产品命名和包 README 契约。
- **[S5]** [`.agents/skills/dsh-doc/references/metadata-links-i18n.md:19–50,62–70`](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/.agents/skills/dsh-doc/references/metadata-links-i18n.md#L19-L70)：元数据、kind 推导、description 用途、双语结构。
- **[S6]** [`scripts/doc-standard.spec.ts:18–25,100–149,343–368`](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/scripts/doc-standard.spec.ts#L18-L149)：机械检查实际扫描范围、字段和结构要求；同文件后段执行检查。
- **[S7]** [`.agents/skills/dsh-doc/templates/package-bundle.md:3–5,23–25,41–64,78–103`](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/.agents/skills/dsh-doc/templates/package-bundle.md#L3-L103)；[`scripts/verify-package-readme-model-experience.ts:282–283`](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/scripts/verify-package-readme-model-experience.ts#L282-L283)；[`scripts/verify-package-readme-limitations.ts:34–35`](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/scripts/verify-package-readme-limitations.ts#L34-L35)：模板与专项检查范围。
- **[S8]** [`docs/AGENTS.md:7–29,36–45,73–75`](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/docs/AGENTS.md#L7-L75)：文档责任、当前态和链接规范。
- **[S9]** [`docs/i18n/README.md:5–22,42–57`](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/docs/i18n/README.md#L5-L57)：上游双语约定及其仓库范围。
- **[S10]** [`docs/cordis-tutorial/index.md:60`](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/docs/cordis-tutorial/index.md#L60)：`powered_by-dsh` 使用实例。
- **[S11]** [`README.md:43–46`](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/README.md#L43-L46)：面向插件仓库的 `dsh-plugin` GitHub Topic 推荐。
- **[S12]** [`apps/cli/reference/README.md:53–55`](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/apps/cli/reference/README.md#L53-L55)；[`apps/cli/src/plugin.ts:132–143`](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/apps/cli/src/plugin.ts#L132-L143)：pnpm PATH 前提及执行、缺失错误。
