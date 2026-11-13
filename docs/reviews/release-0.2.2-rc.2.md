# DSH Research Graph 0.2.2-rc.2 release acceptance

Adaptation for DSH `0.2.2-rc.2`. Per the release policy, the plugin takes the full target version `0.2.2-rc.2`; the exact `@deepseek-ai/dsh-llm` peer and every direct `@deepseek-ai/dsh-*` dependency pin to DSH `0.2.2-rc.2`. Zod follows the upstream dependency line to `4.6.6`, and `dsh-error` is added at the same DSH version for the LLM declaration chain. Node.js remains `>=24.9.0`; Schemastery `~3.19.0` and the Cordis peer `~4.1.0` are unchanged.

The matching Host is official `dsh-v0.2.2-rc.2`, commit `ddac96760b6edf8fa0fe17cbdcf0b512f4c12b2c`. The Harness checkout was clean and its HEAD matched that commit before and after validation; native/lib/web artifacts were rebuilt at that tag on 2026-11-13.

## Scope

Adaptation [PR #85](https://github.com/benz-ai-x/dsh-research-graph/pull/85) covers 1,568 upstream commits since `dsh-v0.2.2-rc.1`, while preserving research-graph behavior:

- Workspace Picker migrates from the removed Menu `getAnchorRect` callback to `anchorRef`, including the stable empty-anchor fallback; standalone Menu declarations follow the same contract.
- The real-stack Conversation fixture supplies the new required `renderFactorySlot`, and Subagent catalog declarations accept optional names for continuable/external entries.
- Host message construction, custom message provenance, SessionQuery observation, historical-branch resume, and Session V4 persistence require no product-code adaptation. Removed Agent runtime-parent APIs are not used by this plugin.
- The vendored sidebar/workspace halves retain their rc.5 extraction and Workspace Folder behavior. Only the required Menu migration is ported; new upstream sidebar, scrolling, context-menu, archive-notice, and style drift is recorded in `VENDORED.md` rather than being presented as a full re-vendor.
- The [compatibility analysis](dsh-0.2.2-rc.2-compatibility.md) records the complete inject/import inventory and per-contract status with upstream file:line evidence.

## Candidate validation

- `pnpm run check`: **253 tests / 30 files**.
- `DSH_HARNESS_ROOT=/Users/pc2026/DSH-Space/deepseek-harness pnpm check:harness` against the official rc.2 tag: all four compiler faces and **361 tests / 25 files**.
- The candidate archive independently passed isolated installation, offline recovery before Host boot, historical Branch continuation, reviewed extraction/synthesis, acknowledged reuse, frozen export, read-only insights, native title rename, folder CRUD with restart (`durableSidebarRestart: true`), and removal with **19 deterministic fixture model calls**; the report identifies plugin `0.2.2-rc.2` and DSH `0.2.2-rc.2`.
- Built-in browser acceptance on the isolated preview: badge **`Research Graph v0.2.2-rc.2 · local-1c4e78ae`** (matching the candidate archive), Workspace/Topic graphs, knowledge reading, session-header More, workspace-menu positioning/selection, narrow-screen sidebar collapse/expand, and Workspace Folder creation/restart/delete. A preview-process timeout interrupted the first delete attempt; after restart the retained folder was visible and deleted successfully. The preview was stopped afterwards.
- The README hero image is refreshed from the same isolated rc.2 Host at **2000×1125** and uses only demonstration data.

Candidate archive: `.artifacts/benz-ai-x-dsh-research-graph-0.2.2-rc.2.tgz`, **733662 bytes**, SHA-256 `ba36f142e2610bd2b0beb87a94f314a20ea66abf8ed2f4758d3ea3c985b2cc0b`; Build ID **`local-1c4e78ae`**. These are local-candidate values, not official npm artifact values.

## Review and merge

Both review axes initially found evidence gaps rather than implementation defects: the UI change needed visual evidence, and the analysis needed per-contract statuses and upstream line references. The added screenshot and [contract matrix](dsh-0.2.2-rc.2-compatibility.md) closed both findings; follow-up Standards and Spec reviews reported no remaining findings.

Adaptation PR #85 passed Node 24, Node 26, and Matching DSH release CI in [run 43372232684](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/43372232684) and merged as **`427759373c32b8c398812fcfa130ebfdbeadc277`**. Its merge tree is identical to accepted head `a4779b8`. Post-merge main CI passed in [run 43373317645](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/43373317645).

## Release boundary

The candidate gates establish local release readiness. Real-provider model quality, true multi-device concurrency, arbitrary dense graph routing, and large-scale performance are outside this fixed-fixture acceptance. No deployment is included in this release workflow.

## Publication

Release-preparation [PR #86](https://github.com/benz-ai-x/dsh-research-graph/pull/86) passed Node 24, Node 26, and Matching DSH release CI in [run 43375600989](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/43375600989), then merged as **`aebf8ca3aed658ba23c9202c253baf352497d2a0`**; its merge tree is identical to accepted head `6ee0986`. Post-merge main CI passed in [run 43376650920](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/43376650920). Annotated tag `v0.2.2-rc.2` points to the release merge commit, and the [GitHub prerelease](https://github.com/benz-ai-x/dsh-research-graph/releases/tag/v0.2.2-rc.2) triggered successful OIDC [Publish run 43376728137](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/43376728137).

- Official registry archive: **733360 bytes**, SHA-256 `143c2dd3eaecb1603432ea8c4a1e416ecfb296f3abf87ce8ca810872b1b9e8a7`, registry SHA-1 `4ea6dfb8399e805291638fd9780da8804a717349`, integrity `sha512-4c24sIeOj+4MTmresCotMOhmljfC32vwGqtMl4KOL+N2rY1DzpXVERa+cAfNASXB3vCtIZZEyUH4mGfSjEXnuw==`. The downloaded bytes match both registry values. npm `next` is `0.2.2-rc.2`; `latest` remains `0.1.5-rc.1`.
- After publication, the user explicitly promoted `0.2.2-rc.2` to npm `latest` on 2026-11-13. Registry readback confirms `latest` and `next` both resolve to `0.2.2-rc.2`; no package bytes changed.
- SLSA provenance names `pkg:npm/@benz-ai-x/dsh-research-graph@0.2.2-rc.2` with the downloaded archive's SHA-512, resolves `git+https://github.com/benz-ai-x/dsh-research-graph@refs/tags/v0.2.2-rc.2` at commit `aebf8ca3aed658ba23c9202c253baf352497d2a0`, and identifies `.github/workflows/publish.yml`, the `release` event, and invocation run `43376728137`. Transparency-log entries are `3847796519` and `3847749957`; the provenance assertions passed locally.
- The official archive independently passed the same isolated packed-profile acceptance with **19 fixture model calls** (`version`/`dshVersion` `0.2.2-rc.2`, `durableSidebarRestart: true`, installed and removed cleanly). Its Build ID is `local-1c4e78ae`, matching the candidate.
- Release attachments (official archive + `SHA256SUMS`) were uploaded, downloaded again, checksum-verified, and byte-compared with the registry archive (`cmp` clean). Private evidence is under `.artifacts/release-0.2.2-rc.2/official/`.
