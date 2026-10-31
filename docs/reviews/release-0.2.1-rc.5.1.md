# DSH Research Graph 0.2.1-rc.5.1 release acceptance

This is the first same-line revision for DSH `0.2.1-rc.5`. Per the release policy, the plugin appends revision `1` to the previously published `0.2.1-rc.5`; the exact `@deepseek-ai/dsh-llm` peer and every direct `@deepseek-ai/dsh-*` dependency remain pinned to DSH `0.2.1-rc.5`.

The matching Host is official `dsh-v0.2.1-rc.5`, commit `b830ec950faba0a46dda564be3e2d854afed94f1`. The Harness checkout was clean and its HEAD was checked before and after validation. The CLI and Web build artifacts were verified newer than the tag commit.

## Scope

Feature commit `cca38bf` refines Sidebar Category presentation and navigation without changing the DSH compatibility target:

- Workspace, category, and Session rows use native-style spacing, neutral selection, and folder icons.
- List and Category views switch through the same footer action in both directions, with identical button geometry.
- Empty Uncategorized appears only as a drag target; collapsed categories containing the current Session retain a subtle marker.
- Workspace totals and the duplicate new-category teaching row are removed. The Workspace and Session menus retain category creation.

No persistence schema, canvas geometry, Research Topic behavior, or Sidebar Category membership semantics change. `@deepseek-ai/schemastery` remains `~3.18.5` and the cordis peer remains `^4.0.2`.

## Candidate validation

- `RELEASE_TAG=v0.2.1-rc.5.1 pnpm run check`: release-version policy, strict types, build, and **260 tests / 28 files** passed.
- `DSH_HARNESS_ROOT=/Users/pc2026/DSH-Space/deepseek-harness pnpm check:harness` against the official rc5 tag: all four compiler faces and **368 tests / 25 files** passed.
- The candidate archive passed isolated installation, offline recovery before Host boot, historical Branch continuation, reviewed extraction/synthesis, acknowledged reuse, frozen export, read-only insights, native title rename, and removal with **19 deterministic fixture model calls**. The report identifies plugin `0.2.1-rc.5.1` and DSH `0.2.1-rc.5`, with `durableSidebarRestart: true`.
- Real rc5 browser acceptance confirmed badge text **`Research Graph v0.2.1-rc.5.1 · local-79620faf`** (matching the candidate archive's Build ID), the Graph view, Category → List → Category footer switching, and removal of the duplicate hint; page errors 0. Earlier light/dark and narrow-container checks found no horizontal overflow. The isolated preview was stopped and the user's daily local DSH profile was not changed.

Candidate archive: `.artifacts/benz-ai-x-dsh-research-graph-0.2.1-rc.5.1.tgz`, **558910 bytes**, SHA-256 `5528d4796e70b7f0cd9ecd9f230009f802c8341e33eee51b320b9909512722da`; Build ID **`local-79620faf`**. These are local-candidate values, not official npm artifact values.

## Release boundary

The candidate gates above establish local release readiness. Canvas/layout/routing code is unchanged, so this release adds no arbitrary-dense-graph non-overlap guarantee. No deployment to 8010 or 8020 is included in this revision.

## Publication

Release-preparation [PR #80](https://github.com/benz-ai-x/dsh-research-graph/pull/80) passed all four CI jobs in [run 41212156723](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/41212156723) and merged as **`40c32c777f9be061a7d6e8983bf2daaa5f320e9f`**; its merge tree is identical to accepted head `a7ef406b2d62c1842fdbb41689acc74e5573c6e2`. Post-merge [main CI 41218844349](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/41218844349) passed. Annotated tag `v0.2.1-rc.5.1` points to the release merge commit, and the [GitHub prerelease](https://github.com/benz-ai-x/dsh-research-graph/releases/tag/v0.2.1-rc.5.1) triggered successful OIDC [Publish run 41219439444](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/41219439444).

- Official registry archive: **558143 bytes**, SHA-256 `7a095b7191125ffc6280b5769c40518c34697b25eca8ede939e278bb94d97666`, registry SHA-1 `6289475ee936bbb9fb7e6975163f16698aa45ac2`, integrity `sha512-dvRS/Hkpp0mMlDAv3+K/mrCcjQ6Y6/k3b4dac9e0nmtITohBiBMyzO1pXZsAgk+xrc+ZT24icjCb1YYWHb3rIQ==`. These values are distinct from the local candidate above.
- SLSA provenance matches repository `benz-ai-x/dsh-research-graph`, `.github/workflows/publish.yml`, `refs/tags/v0.2.1-rc.5.1`, commit `40c32c777f9be061a7d6e8983bf2daaa5f320e9f`, Publish run `41219439444`, and the downloaded archive's SHA-512 (`76f452fc…deb21`, byte-identical). Transparency-log entries: `3614472028` and `3614470212`.
- The official archive independently passed the same isolated packed-profile acceptance with **19 fixture model calls** (`version`/`dshVersion` `0.2.1-rc.5.1`/`0.2.1-rc.5`, `durableSidebarRestart: true`, installed and removed cleanly). npm `next` is `0.2.1-rc.5.1`; `latest` remains `0.1.5-rc.1`.
- Release attachments (official archive + `SHA256SUMS`) were uploaded, downloaded again, checksum-verified, and byte-compared with the registry archive (`cmp` clean). Private evidence is under `.artifacts/release-0.2.1-rc.5.1/official/`.
