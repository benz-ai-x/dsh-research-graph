# DSH Research Graph 0.2.2-rc.3 release acceptance

Adaptation for DSH `0.2.2-rc.3`. Per the release policy, the plugin takes the full target version `0.2.2-rc.3`; the exact `@deepseek-ai/dsh-llm` peer and every direct `@deepseek-ai/dsh-*` dependency pin to DSH `0.2.2-rc.3`. Zod remains `4.6.6`; `dsh-error` remains at the same DSH version for the LLM declaration chain. Node.js remains `>=24.9.0`; Schemastery `~3.19.0` and the Cordis peer `~4.1.0` are unchanged.

The matching Host is official `dsh-v0.2.2-rc.3`, commit `38a6a5c965aa99ab525161efb7cc5cf1fe62fced`. The Harness checkout was clean and its HEAD matched that commit before and after validation; native/lib/web artifacts were rebuilt at that tag on 2026-11-14.

## Scope

Adaptation [PR #87](https://github.com/benz-ai-x/dsh-research-graph/pull/87) covers six upstream commits since `dsh-v0.2.2-rc.2`, while preserving research-graph behavior:

- The reusable `workspace.picker` Factory and `workspace.picker.directoryFlow` are registered with the original picker, so both official directory-picker backends can activate rather than waiting for a missing declaration. The surface flow, occupancy sources, `WorkspacePickerInput`, and Factory props are shared.
- The New Session row renders through the `sidebar.session.action` HOC while keeping the original Tooltip and button. Workspace Folders, native row menus, and all local deltas remain intact; this is not a full re-vendor.
- Host message construction, custom message provenance, SessionQuery observation, historical-branch resume, projections, and Session V4 persistence require no product-code adaptation. Zod, Cordis, Schemastery, Node.js, and Session formats are unchanged.
- The [compatibility analysis](dsh-0.2.2-rc.3-compatibility.md) records the complete inject/import inventory and per-contract status with upstream file:line evidence.

## Candidate validation

- `pnpm run check`: **253 tests / 30 files**.
- `DSH_HARNESS_ROOT=/Users/pc2026/DSH-Space/deepseek-harness pnpm check:harness` against the official rc.3 tag: all four compiler faces and **362 tests / 25 files**, including a dedicated Factory/HOC composition case.
- The candidate archive independently passed isolated installation, offline recovery before Host boot, historical Branch continuation, reviewed extraction/synthesis, acknowledged reuse, frozen export, read-only insights, native title rename, folder CRUD with restart (`durableSidebarRestart: true`), and removal with **19 deterministic fixture model calls**; the report identifies plugin `0.2.2-rc.3` and DSH `0.2.2-rc.3`.
- Built-in browser acceptance on the isolated preview: badge **`Research Graph v0.2.2-rc.3 · local-70cd4182`** (matching the candidate archive), successful Host startup without a pending third directory-flow injection, workspace-menu positioning and selection, Workspace/Topic graphs, knowledge reading, narrow-screen sidebar collapse/expand, and the Workspace Folder creation entry. The preview was stopped afterwards.
- The README hero image was refreshed from the same isolated rc.3 Host at **2000×1125** and contains only demonstration data.

Candidate archive: `.artifacts/benz-ai-x-dsh-research-graph-0.2.2-rc.3.tgz`, **734165 bytes**, SHA-256 `7fc8676c3c68ac7c107880331cf1d16f42f41a5116140ac834ca33ebaf7fa7cd`; Build ID **`local-70cd4182`**. These are local-candidate values, not official npm artifact values.

## Merge

Adaptation PR #87 passed Node 24, Node 26, and Matching DSH release CI in [run 43548102601](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/43548102601) and merged as **`1b33627c15504666708a90c556fc9265b6c67ddc`**. Its merge tree is identical to accepted head `2670eff`.

## Release boundary

The candidate gates establish local release readiness. Real-provider model quality, true multi-device concurrency, arbitrary dense graph routing, and large-scale performance are outside this fixed-fixture acceptance. No deployment is included in this release workflow.

## Publication

Official registry, provenance, packed-profile, and Release-attachment evidence is appended only after those artifacts have been published and independently verified.
