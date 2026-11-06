# DSH Research Graph 0.2.2-rc.1 release acceptance

First adaptation for DSH `0.2.2-rc.1`. Per the release policy, the plugin takes the full target version `0.2.2-rc.1`; the exact `@deepseek-ai/dsh-llm` peer and every direct `@deepseek-ai/dsh-*` dependency pin to DSH `0.2.2-rc.1`. `@deepseek-ai/schemastery` moves to `~3.19.0` and the cordis peer to `~4.1.0`, matching upstream published ranges. The plugin `engines` field tightens to Node.js `>=24.9.0` together with the host line (CI matrix: Node 24 and 26).

The matching Host is official `dsh-v0.2.2-rc.1`, commit `66491b05e3f05ad35bcdd4f6cd7ed26041d9e3db`. The Harness checkout was clean and its HEAD matched that commit before and after validation; native/lib/web artifacts were rebuilt at that tag on 2026-11-06 and verified newer than the tag commit.

## Scope

Adaptation [PR #83](https://github.com/benz-ai-x/dsh-research-graph/pull/83) (2623 upstream commits since `dsh-v0.2.1-rc.5`), keeping research-graph behavior unchanged:

- Host reads follow the 0.2.2 faces: the removed `SessionController.inspect`/`inspectApiSession` is mirrored by `src/session-inspect.ts` through `sessionQuery.observeSession(id, { projectionMode: 'none' })` (live-first, persisted-no-cwd ⇒ not-found, disposable lease); 15 call sites migrated, the branch seed path observes directly to keep the real `SessionEvent[]`; the root inject adds `sessionQuery`.
- Projection summary keys (`sessionStats`, `turnOutline`, `todos`, `contextPressure`; also `imageLimits`, `contextBreakdown`) are `summary: false` in 0.2.2 list-row types while exact `session.projections` reads still return every key on the wire — `graph-model.ts` folds through `Partial<SessionProjectionMap>` with no runtime data loss.
- SessionStore's 0.2.2 write gate (`session-store-writes` upgrade guide) is respected: historical-branch cancellation events for inherited queued input are journaled into the frozen seed after the native `session/end-seed` marker (same shape as upstream `buildForkSeed`) instead of appending to the read-only prepared child; a regression test covers the path end-to-end (`prepared → ready`, inherited count unchanged).
- Client faces: the views bench stubs the new required `InputActions.insertQuote` member and the global root prop `useContextMenu` from the new `@deepseek-ai/dsh-client-ui-context-menu` package.
- `dsh-llm@0.2.2-rc.1` published types import `@deepseek-ai/dsh-package-manifest`, which upstream lists only in devDependencies; the plugin adds it as a devDependency pinned to `0.2.2-rc.1` so the standalone face resolves.
- The vendored sidebar halves stay at the `dsh-v0.2.1-rc.5` extraction: all four compiler faces compile them unchanged against the 0.2.2-rc.1 checkout, and the runtime gates below cover them; upstream drift (drawer adaptation, six new languages, `contextMenus` rework, `AnimatedRows` upstreaming, slot-priority shadowing removal) is recorded in `VENDORED.md` for a dedicated re-vendor round. Upstream has no native folders feature.
- Test fixtures migrated to the 0.2.2 store/controller contracts (`sessions.create` for live rows, `writeColdHistory` for cold ones, awaited `createSessionTestController/Remote`, `agents` inject for list summaries, observation-face stubs). A previous 100%-CPU hang in `host.harness.spec` was traced to the bare test Context missing `sessionQuery` after the read-face switch.

## Candidate validation

- `pnpm run check`: **253 tests / 30 files**.
- `DSH_HARNESS_ROOT=/Users/pc2026/DSH-Space/deepseek-harness pnpm check:harness` against the official 0.2.2-rc.1 tag: all four compiler faces and **361 tests / 25 files** (including the new queued-input branch regression).
- The candidate archive independently passed isolated installation, offline recovery before Host boot, historical Branch continuation, reviewed extraction/synthesis, acknowledged reuse, frozen export, read-only insights, native title rename, folder CRUD with restart (`durableSidebarRestart: true`), and removal with **19 deterministic fixture model calls**; the report identifies plugin `0.2.2-rc.1` and DSH `0.2.2-rc.1`.
- Built-in browser acceptance on the isolated preview: badge **`Research Graph v0.2.2-rc.1 · local-3e166337`** (matching the candidate archive), the topic-mode graph (session cards, merge badge, legend, minimap), the vendored sidebar tree, the workspace menu “新建文件夹” entry, and narrow-screen (895px) sidebar collapse/expand; zero page errors. The preview was stopped afterwards.

Candidate archive: `.artifacts/benz-ai-x-dsh-research-graph-0.2.2-rc.1.tgz`, **731952 bytes**, SHA-256 `a05c29c0095ec5d77e8be730053984203323270920c16fc745797dad02090ff8`; Build ID **`local-3e166337`**. These are local-candidate values, not official npm artifact values.

## Merge

Adaptation PR #83 passed all four CI jobs in [run 42183833488](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/42183833488) (Node 24, Node 26, Matching DSH release 7m28s) and merged as **`3a2058f`**; its merge tree is identical to accepted head `1b32c78`. Post-merge main CI passed.

## Release boundary

The candidate gates establish local release readiness. Real-provider model quality, true multi-device concurrency, and large-scale performance are outside this fixed-fixture acceptance. The README hero image for this release was captured at 1280×914 (the local in-app browser renders at device pixel ratio 1 and rejects larger viewports in this session); previous releases shipped 2560×1828 captures of the same composition.

## Publication

(to be completed after publication)
