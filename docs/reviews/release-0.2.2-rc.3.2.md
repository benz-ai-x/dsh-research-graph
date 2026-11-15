# DSH Research Graph 0.2.2-rc.3.2 release acceptance

This is the second same-line revision for DSH `0.2.2-rc.3`. Per the release policy, the plugin appends revision `2` to `0.2.2-rc.3`; the exact `@deepseek-ai/dsh-llm` peer and every direct `@deepseek-ai/dsh-*` dependency remain pinned to DSH `0.2.2-rc.3`. Zod remains `4.6.6`; Node.js remains `>=24.9.0`; Schemastery `~3.19.0` and the Cordis peer `~4.1.0` are unchanged.

The matching Host is official `dsh-v0.2.2-rc.3`, commit `38a6a5c965aa99ab525161efb7cc5cf1fe62fced`. The Harness checkout was clean and its HEAD matched that commit during validation; its native/lib/web artifacts had been rebuilt at that tag. No compatibility or persistence-format adaptation is included in this revision.

## Scope

Feature [PR #92](https://github.com/benz-ai-x/dsh-research-graph/pull/92) restores Workspace membership after removing and re-adding the same directory:

- Native Workspace creation remains authoritative. The existing plugin then restores currently unaccounted Sessions whose live-preferred headers resolve to the same canonical directory, using the official `attachSession()` API and no Session-log changes.
- The sidebar and WorkspacePicker/Factory share the same restoring creation callback. Restoration is idempotent; an interrupted write reports failure, retains valid completed attachments, and accepts a same-path retry.
- Sessions owned by another Workspace, different or unresolvable directories, archive state, and existing Workspace Folder assignments are not moved or rewritten. A recreated Workspace has a new identity; browser arrangements, manual member order, and old Workspace Folder structure are not restored.
- The capability remains inside `@benz-ai-x/dsh-research-graph`; no separate plugin, storage domain, upstream source edit, or new dependency was introduced. Bilingual guides disclose the behavior and its limits.

## Candidate validation

- `RELEASE_TAG=v0.2.2-rc.3.2 pnpm run check`: release policy, strict types, build, and **274 tests / 32 files** passed.
- `DSH_HARNESS_ROOT=/Users/pc2026/DSH-Space/deepseek-harness pnpm check:harness`: all four compiler faces and **375 tests / 27 files** passed.
- The candidate archive independently passed isolated installation, offline recovery before Host boot, historical Branch continuation, reviewed extraction/synthesis, acknowledged reuse, frozen export, read-only insights, native title rename, folder CRUD with restart (`durableSidebarRestart: true`), and removal with **19 deterministic fixture model calls**. The report identifies plugin `0.2.2-rc.3.2` and DSH `0.2.2-rc.3`.
- Built-in browser acceptance on the isolated preview confirmed badge **`Research Graph v0.2.2-rc.3.2 · local-f90ac8ca`**, the two-Session Workspace graph, and the persisted restoration fixture. The original removal/re-add scenario, browser refresh, and Host restart passed during feature acceptance. The preview was stopped afterwards; the daily profile was not changed.
- The README graph image remains the existing fixed demonstration because this revision does not change canvas presentation. The inspected restoration screenshot is `docs/reviews/assets/workspace-membership-restoration.png`.

Candidate archive: `.artifacts/release-0.2.2-rc.3.2/candidate/benz-ai-x-dsh-research-graph-0.2.2-rc.3.2.tgz`, **748334 bytes**, SHA-256 `a00feb9e5c9a6089454104ad0db2fb70680bdf3868034fac65179bd66b39517f`; Build ID **`local-f90ac8ca`**. These are local-candidate values, not official npm artifact values.

## Merge

Feature PR #92 passed Node 24, Node 26, and Matching DSH release CI in [run 43695292699](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/43695292699) and merged as **`d05ba6dcf67a440985bb3dd16a965ddaece1e8d0`**. Post-merge [main CI run 43695788339](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/43695788339) passed. Two-axis review found no Spec deviations; the initial Standards marker finding was corrected and rechecked before merge.

## Release boundary

The candidate gates establish local release readiness. Real-provider model quality, true multi-device concurrency, arbitrary dense graph routing, and large-scale performance are outside this fixed-fixture acceptance. Restoration is a directory-based membership operation, not recovery of the deleted Workspace identity or its folder records. No deployment is included in this release workflow.

## Publication

Release preparation [PR #93](https://github.com/benz-ai-x/dsh-research-graph/pull/93) passed CI in [run 43697301389](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/43697301389) and merged as **`faa95f83d11cb16265abc3e04732c305103f330e`**. Its merge tree is identical to accepted release head `01ed54062e5e2f10ac734ed10cb220c07e1b443e`. Post-merge [main CI run 43697949396](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/43697949396) passed. The annotated tag `v0.2.2-rc.3.2` points to that merge; the [GitHub prerelease](https://github.com/benz-ai-x/dsh-research-graph/releases/tag/v0.2.2-rc.3.2) triggered successful OIDC [Publish run 43698686426](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/43698686426). Registry readback is **`next=0.2.2-rc.3.2`**, **`latest=0.2.2-rc.2`**; this release did not change `latest` or deploy the plugin.

The independently downloaded official npm archive is **746994 bytes**, SHA-256 `0c2d4067785b17f3cc177e411c73b7e0d26b3e7d1e6bc47e1cba6593b0711b20`, registry SHA-1 `fbd803c1a1ed6a8fae8ba473ed741afbdabd70ff`, with integrity `sha512-mCBqoZS/jmU3F2sggDWH/upattgaHDaLBUfu3890O6Ub7zY/ab2wXODdgRyojhRvBHh0f6iQCLSEGKvk1Uw2Bw==`. Its Build ID is **`local-f90ac8ca`**. The local candidate remains **748334 bytes**, SHA-256 `a00feb9e5c9a6089454104ad0db2fb70680bdf3868034fac65179bd66b39517f`; those candidate values are not the official npm artifact values.

SLSA provenance assertions covered the archive subject, `refs/tags/v0.2.2-rc.3.2`, commit `faa95f83d11cb16265abc3e04732c305103f330e`, `.github/workflows/publish.yml`, release event, and invocation run `43698686426`; transparency-log entries **`3899073069`** and **`3899113421`** were verified. The official archive independently passed the same isolated packed-profile acceptance with **19 deterministic fixture model calls**, including offline recovery, research writes, sidebar restart persistence, and clean installation/removal. The Release archive and `SHA256SUMS` were uploaded, downloaded again, and compared byte-for-byte with the official registry archive. Private verification evidence is retained in `.artifacts/release-0.2.2-rc.3.2/official/`.
