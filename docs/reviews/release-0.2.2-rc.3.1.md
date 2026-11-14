# DSH Research Graph 0.2.2-rc.3.1 release acceptance

This is the first same-line revision for DSH `0.2.2-rc.3`. Per the release policy, the plugin appends revision `1` to `0.2.2-rc.3`; the exact `@deepseek-ai/dsh-llm` peer and every direct `@deepseek-ai/dsh-*` dependency remain pinned to DSH `0.2.2-rc.3`. Zod remains `4.6.6`; Node.js remains `>=24.9.0`; Schemastery `~3.19.0` and the Cordis peer `~4.1.0` are unchanged.

The matching Host is official `dsh-v0.2.2-rc.3`, commit `38a6a5c965aa99ab525161efb7cc5cf1fe62fced`. The Harness checkout was clean and its HEAD matched that commit during validation; its native/lib/web artifacts had been rebuilt at that tag. The expired temporary pnpm minimum-release-age override was removed from CI and publishing; a frozen install passed without it.

## Scope

Issue [#89](https://github.com/benz-ai-x/dsh-research-graph/issues/89) and feature [PR #90](https://github.com/benz-ai-x/dsh-research-graph/pull/90) restore Branch edges after DSH made ordinary forks independent Sessions:

- Plugin-owned Branch Origins persist exact canvas fork origins and verifiably inferred current-generation origins for existing and native forks. Workspace and Topic graphs share the fallback while current Host parentage remains authoritative.
- A successful canvas fork reloads origins after its record attempt, covering the native child entering the visible scope before the record completes. Record failure does not fail the fork.
- Nested forks without a current-generation marker, unavailable or unverifiable sources remain Root Sessions. Inherited Merge snapshots do not create duplicate direct Merge Relations.
- Shared inference is service-lifecycle-owned with per-caller cancellation and disposal draining. In-flight exact records block inferred writes, so an inferred record cannot replace an exact parent.
- All visible members are read in sequential batches of at most 120 IDs. Bilingual guides disclose the plugin-owned persistence and unchanged model-call behavior.

## Candidate validation

- `RELEASE_TAG=v0.2.2-rc.3.1 pnpm run check`: release policy, strict types, build, and **271 tests / 31 files** passed.
- `DSH_HARNESS_ROOT=/Users/pc2026/DSH-Space/deepseek-harness pnpm check:harness`: all four compiler faces and **372 tests / 26 files** passed.
- The candidate archive independently passed isolated installation, offline recovery before Host boot, historical Branch continuation, reviewed extraction/synthesis, acknowledged reuse, frozen export, read-only insights, native title rename, folder CRUD with restart (`durableSidebarRestart: true`), and removal with **19 deterministic fixture model calls**. The report identifies plugin `0.2.2-rc.3.1` and DSH `0.2.2-rc.3`.
- Built-in browser acceptance on the isolated preview confirmed badge **`Research Graph v0.2.2-rc.3.1 · local-f77f15a1`**, Workspace graphs, restored independent-fork Branch arrows, and their persistence across Host restart. The preview was stopped afterwards; the daily profile was not changed.
- The README hero image was refreshed from this isolated candidate at **2000×1125** and contains only fixed demonstration data.

Candidate archive: `.artifacts/benz-ai-x-dsh-research-graph-0.2.2-rc.3.1.tgz`, **745139 bytes**, SHA-256 `6718e7de67155074f5ad3494e5c9568499d7524ab068b0c3b1db2933da4233db`; Build ID **`local-f77f15a1`**. These are local-candidate values, not official npm artifact values.

## Merge

Feature PR #90 passed Node 24, Node 26, and Matching DSH release CI in [run 43611481399](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/43611481399) and merged as **`977e1fd94239cb4415e05d07ee62665d5e3f3b4d`**. Its merge tree is identical to accepted head `5f50154921b1297e086cf4dda5f9b8ef1b00d4fb`. Post-merge [main CI run 43612102338](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/43612102338) passed.

## Release boundary

The candidate gates establish local release readiness. Real-provider model quality, true multi-device concurrency, arbitrary dense graph routing, and large-scale performance are outside this fixed-fixture acceptance. No deployment is included in this release workflow.

## Publication

Release preparation [PR #91](https://github.com/benz-ai-x/dsh-research-graph/pull/91) passed CI in [run 43613787750](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/43613787750) and merged as **`782a4feb34b7fc73a10cb8631b99d9215343600f`**. Its merge tree is identical to accepted release head `b74e469`. Post-merge [main CI run 43614367963](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/43614367963) passed. The annotated tag `v0.2.2-rc.3.1` points to that merge; the [GitHub prerelease](https://github.com/benz-ai-x/dsh-research-graph/releases/tag/v0.2.2-rc.3.1) triggered successful OIDC [Publish run 43615148193](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/43615148193). Registry readback is **`next=0.2.2-rc.3.1`**, **`latest=0.2.2-rc.2`**; this release did not change `latest` or deploy the plugin.

The independently downloaded official npm archive is **743748 bytes**, SHA-256 `63f18031eef2650b0f27bff314f357955b1d9ed9a5eb8070e3438fcdfd144591`, registry SHA-1 `a2627c739bd1a877a043f17244428c67f71435d4`, with integrity `sha512-rEWtuLVQvnYQAdDDGtmNMVCQmWngl3gBZZArwu6/Lg/cmGiW5u1ThJ6SULlDotFBTyLi6Q7rIisg+ZUT/bc6BA==`. Its Build ID is **`local-f77f15a1`**. The local candidate remains **745139 bytes**, SHA-256 `6718e7de67155074f5ad3494e5c9568499d7524ab068b0c3b1db2933da4233db`; those candidate values are not the official npm artifact values.

SLSA provenance assertions covered the archive subject, `refs/tags/v0.2.2-rc.3.1`, commit `782a4feb34b7fc73a10cb8631b99d9215343600f`, `.github/workflows/publish.yml`, release event, and invocation run `43615148193`; transparency-log entries **`3881994657`** and **`3882068820`** were verified. The official archive independently passed the same isolated packed-profile acceptance with **19 deterministic fixture model calls**, including offline recovery, research writes, sidebar restart persistence, and clean installation/removal. The Release archive and `SHA256SUMS` were uploaded, downloaded again, and compared byte-for-byte with the official registry archive. Private verification evidence is retained in `.artifacts/release-0.2.2-rc.3.1/official/`.
