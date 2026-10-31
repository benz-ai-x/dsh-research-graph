# DSH Research Graph 0.2.1-rc.5 release acceptance

This is the first adaptation of the DSH `0.2.1-rc.5` line. Per the release policy, the plugin takes the full target version `0.2.1-rc.5`; the exact `@deepseek-ai/dsh-llm` peer and every direct `@deepseek-ai/dsh-*` dependency follow it. The previous published plugin `0.2.1-rc.4` cannot load on rc5 because of the exact peer check.

The matching Host is official `dsh-v0.2.1-rc.5`, commit `b830ec950faba0a46dda564be3e2d854afed94f1`. Native/lib/web were rebuilt at that tag, and build artifacts were verified newer than the tag commit (2026-10-29 21:01:28 +0800). The Harness checkout was clean and its HEAD was checked before and after validation.

## Compatibility and scope

Upstream `dsh-v0.2.1-rc.4..dsh-v0.2.1-rc.5` contains 3 commits (one fix plus the release commit). The only substantive delta customizes thinking-block rendering inside `ui-chat` (#7484): `ReasoningBodyOwnerProps` gains a required `rawText`, `ReasoningContentInput` becomes a standalone interface, and the `conversation.chat.reasoning.body` slot documentation is updated. None of it is on this plugin's dependency surface — the plugin does not import `dsh-client-ui-chat`, and its `dsh-client-ui-slots` imports are limited to the `InjectFace`/`PropsLocale` types. Every other direct dependency package has version-only changes, and the upstream root manifest changes only its version.

No product source, test fixture, persistence schema, canvas geometry, Host service behavior, or Research Topic/Sidebar Category semantics required adaptation. `@deepseek-ai/schemastery` remains `~3.18.5` and the cordis peer remains `^4.0.2`.

The upstream packages were published 2026-10-29 13:46–14:15 UTC; the 24-hour install age gate (based on the line's latest package `dsh@0.2.1-rc.5`, 14:15:23 UTC) closed on 2026-10-30, so no CI exemption was restored for this round.

## Candidate validation

- `pnpm run check`: release-version policy, strict types, build, and **260 tests / 28 files** passed.
- `DSH_HARNESS_ROOT=/Users/pc2026/DSH-Space/deepseek-harness pnpm check:harness` against the official rc5 tag: all four compiler faces and **364 tests / 25 files** passed on the first run — zero contract findings, as expected for a pin-only round.
- The candidate archive passed isolated installation, offline recovery before Host boot, historical Branch continuation, reviewed extraction/synthesis, acknowledged reuse, frozen export, read-only insights, native title rename, and removal with **19 deterministic fixture model calls** (`version` and `dshVersion` both `0.2.1-rc.5`).
- Packed acceptance also verified durable Topics and Sidebar Categories, and `durableSidebarRestart: true` after a full stop/start of the same isolated profile.
- Real rc5 browser preview confirmed Sidebar Categories, the Research Graph entry, badge **`Research Graph v0.2.1-rc.5 · local-24818a0c`** (matching the candidate archive's Build ID), and the workspace graph with the merge Session card, legend, and minimap; page errors 0. The isolated preview was stopped; the user's daily local DSH profile was not changed.

Candidate archive: `.artifacts/benz-ai-x-dsh-research-graph-0.2.1-rc.5.tgz`, **558556 bytes**, SHA-256 `c3ec527fb9632cf4af6f2fa9ce1a7ce83a73300ec440a5588e67ec780757f255`; Build ID **`local-24818a0c`**. These are local-candidate values, not official npm artifact values.

## Release boundary

The candidate gates above established local compatibility and release readiness. Compatibility [PR #78](https://github.com/benz-ai-x/dsh-research-graph/pull/78) passed all four CI jobs in [run 41171402067](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/41171402067) and merged as `78046085f4b721496469ba1deb010b4a0db8557d`; its merge tree is identical to accepted head `af327dff6ff47fd1ad82122d9e165d8c4a2d8187`. Post-merge [main CI 41171945278](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/41171945278) passed.

The canvas/layout/routing code is unchanged, so this release adds no new arbitrary-dense-graph non-overlap guarantee. Previous deferred research features and real-provider quality evaluations remain outside this compatibility revision. No 8010 upgrade is claimed for rc5 in this record.

## Publication

Release-preparation [PR #79](https://github.com/benz-ai-x/dsh-research-graph/pull/79) passed all four CI jobs in [run 41172144736](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/41172144736) and merged as **`e3a68a8776de44764e7242bfe7532c2d82412f60`**; its merge tree is identical to accepted head `8e83ce0ed9375c0c8c07e46672c0f05a9a631a95`. Post-merge [main CI 41172681099](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/41172681099) passed. Annotated tag `v0.2.1-rc.5` points to the release merge commit, and the [GitHub prerelease](https://github.com/benz-ai-x/dsh-research-graph/releases/tag/v0.2.1-rc.5) triggered successful OIDC [Publish run 41172741593](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/41172741593).

- Official registry archive: **557772 bytes**, SHA-256 `146d83c3d7dc3df38560d19c7a1811fe52d48d4781ec2b394876150af61d7447`, registry SHA-1 `533dbdf20f785c8a46534e591de8eedbb63d24a5`, integrity `sha512-oC6SKPLmW4GU5i7GeEU2wqqEVFVX2FplPAz9S3EPdApRACJNPnWCX2+i7rY/bWTvK+YbdmpXy/nKz5/3DVYhdA==`. These values are distinct from the local candidate above.
- SLSA provenance matches repository `benz-ai-x/dsh-research-graph`, `.github/workflows/publish.yml`, `refs/tags/v0.2.1-rc.5`, commit `e3a68a8776de44764e7242bfe7532c2d82412f60`, and the downloaded archive's SHA-512 (`a02e9228…62174`, byte-identical). Transparency-log entries: `3610593687` and `3610582714`.
- The official archive independently passed the same isolated packed-profile acceptance with **19 fixture model calls** (`version`/`dshVersion` both `0.2.1-rc.5`, `durableSidebarRestart: true`, installed and removed cleanly). npm `next` is `0.2.1-rc.5`; `latest` remains `0.1.5-rc.1`.
- Release attachments (official archive + `SHA256SUMS`) were uploaded, downloaded again, checksum-verified, and byte-compared with the registry archive (`cmp` clean). Private evidence is under `.artifacts/release-0.2.1-rc.5/official/`.

