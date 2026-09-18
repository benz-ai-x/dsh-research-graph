---
description: "A DeepSeek Harness Web plugin for AI conversation graphs, research topics, and source-linked Knowledge Cards. Explore capabilities, check compatibility, and install the research workbench."
kind: "package-bundle"
---

<a id="dsh-research-graph--研图"></a>

# DSH Research Graph

[![CI](https://github.com/benz-ai-x/dsh-research-graph/actions/workflows/ci.yml/badge.svg)](https://github.com/benz-ai-x/dsh-research-graph/actions/workflows/ci.yml) [![npm](https://img.shields.io/npm/v/%40benz-ai-x%2Fdsh-research-graph/next?logo=npm)](https://www.npmjs.com/package/@benz-ai-x/dsh-research-graph) [![MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**English** | [简体中文](README.zh.md)

An independently maintained, open-source **AI research workbench plugin** for [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness), running inside **DSH Web**. Organize conversations into research topics and traceable Knowledge Cards for product research, technical research, and ongoing knowledge management.

## Capability map

```mermaid
---
config:
  flowchart:
    nodeSpacing: 16
    rankSpacing: 32
---
flowchart LR
  G["DSH Research Graph"] --> O["Organize research"] & K["Capture knowledge"] & R["Extend research"]
  O --> O1["Cross-workspace topics"] & O2["Conversation graph<br/>Branches · Merges<br/>Subagent records"]
  K --> K1["History search<br/>Sources · Digests"] & K2["Knowledge Cards<br/>AI extraction · Review · Revisions"]
  R --> R1["Synthesis · Frozen materials"] & R2["Follow-up discussions<br/>Markdown export"]
  classDef brand fill:#2563eb,stroke:#2563eb,color:#fff
  classDef group fill:#eff6ff,stroke:#93c5fd,color:#1e3a8a
  classDef feature fill:#f8fafc,stroke:#cbd5e1,color:#0f172a
  class G brand
  class O,K,R group
  class O1,O2,K1,K2,R1,R2 feature
```

## Workbench screenshot

<p align="center">
  <a href="docs/assets/readme/research-workbench.png">
    <img src="docs/assets/readme/research-workbench.png" alt="Research workbench linking source discussions, Knowledge Cards, and follow-up research, with conclusions, revisions, and source links in the reader" width="100%" />
  </a>
</p>

Version 0.1.5-rc.2.8 with demo data. Click the image for the full-resolution screenshot.

<a id="features"></a>
<a id="what-it-adds"></a>

## Key capabilities

| Capability | What you can do |
| --- | --- |
| **Research graph** | Organize discussions, inspect branches and merges; drag, collapse, and relayout |
| **Source tracing** | Search discussion text and return to the exact original turns |
| **Knowledge capture** | Save conclusions, conditions, and open questions; edit through new revisions |
| **AI analysis** | Extract selected discussion and compare 2–3 materials; review before saving |
| **Follow-up research** | Start from a historical turn or chosen card revision, retaining the materials used |
| **Tasks and delivery** | Inspect existing subagent records and export Markdown research results |

<a id="compatibility"></a>
<a id="dsh-and-agent-presets"></a>

## Key facts

| Item | Details |
| --- | --- |
| Plugin release | [0.1.6-alpha.2](https://github.com/benz-ai-x/dsh-research-graph/releases/tag/v0.1.6-alpha.2), npm `next` |
| Required Host | **DSH 0.1.6-alpha.2 · Web**, Node.js `^22.19.0 \|\| >=24.0.0` |
| Data | Research records live on the DSH Host; working positions stay in the browser and Topic arrangements require explicit saving |
| Model calls | Browsing, manual capture, and export make no model call; AI generation and new discussions use models on demand |
| Agent capabilities | DSH provides models, tools, presets, and agent execution; this plugin includes no preset or Agent Team launcher. [Details](docs/user-guide.md#dsh-and-agent-presets) |
| Stack and license | TypeScript · React · [MIT](LICENSE) |

<a id="install"></a>

## Quick start

Requires **DSH 0.1.6-alpha.2**, with both `dsh` and `pnpm` on your `PATH`. Stop any running `dsh web`, then run:

```sh
dsh plugin --profile web add @benz-ai-x/dsh-research-graph@0.1.6-alpha.2
dsh web
```

Open the login URL printed in the terminal, enter a **non-blank Session**, and select **Research Graph**: read a source → save knowledge → continue the discussion. See [installation options](docs/user-guide.md#install) if you run DSH through `npx` or from source.

## Docs and support

[User guide](docs/user-guide.md) · [Troubleshooting](docs/user-guide.md#troubleshooting) · [Development and release](docs/development.md) · [Release acceptance](docs/reviews/release-0.1.6-alpha.2.md) · [Report an issue](https://github.com/benz-ai-x/dsh-research-graph/issues)
