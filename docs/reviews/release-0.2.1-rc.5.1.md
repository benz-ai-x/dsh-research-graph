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
