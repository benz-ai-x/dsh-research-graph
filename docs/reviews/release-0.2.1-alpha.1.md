# DSH Research Graph 0.2.1-alpha.1 release acceptance

This is the first adaptation of the DSH `0.2.1-alpha.1` line: per the release policy the plugin takes the full target version (`0.2.1-alpha.1`) and every direct `@deepseek-ai/dsh-*` dependency is pinned to it. Upstream `dsh-v0.2.0-rc.2..dsh-v0.2.1-alpha.1` spans 266 commits; a package-by-package diff of the plugin's actual dependency surface (direct dependencies, `dsh.client.inject`, every `@deepseek-ai/*` import across `src`/`types`/`tests`/`scripts`, and the standalone adapters) found exactly two breaking changes:

1. **The invariants system was removed upstream.** `@deepseek-ai/dsh-invariants` (formerly `packages/runtime-diagnostics/invariants`) and every per-package `src/invariant.ts` companion are gone, and npm has no `0.2.1-alpha.1` of that package. The plugin's companion was only ever referenced by its own tests and compiler faces — the Host never loaded it, and its registration had no research-behavior effect. This release drops it: `src/invariant.ts`, the `./invariant` export and `lib/invariant.js` file entry, `tests/invariant.client.spec.ts`, the compiler-face entries in `scripts/check-harness-types.mjs`, both standalone adapter declarations in `types/`, and the entry descriptions in `AGENTS.md` and `docs/development*.md`.
2. **A conversation session contract rename.** `ConversationSessionInjected.bindDraftMirror` became `bindDraftPersistence` (the writer now receives a `DraftSnapshot`), and `InputActions`/`InputState` members moved from image-\* to attachment-\* plus new `persistDraft`/`captureInsertion`/`insertText`. The plugin's client never consumes these members; only the `tests/views.client.spec.tsx` mount stubs needed alignment. That spec file sits outside the standalone tsconfig include, so the drift surfaced at harness runtime (`inputActions.persistDraft is not a function`) rather than at typecheck — the designed discovery step, fixed by aligning the stubs to the current interface.

Everything else on the surface is additive or internal: `startSession` gained an optional draft-initialization parameter, session-controller list work-slicing is internal, agent-preset-registry's removed exports (`livePresetMounts`, `serviceForAgent`, `standingMountFor`) were never referenced, and the vendored cordis `4.0.5-alpha.1` passes the boot peer check (`semver.satisfies` with `includePrerelease: true`, and only `@deepseek-ai/dsh*` peers are validated). `@deepseek-ai/schemastery` moves from `^3.18.4` to `~3.18.5-alpha.1` — the same range upstream dsh packages declare — eliminating a dual-version declaration conflict that broke typecheck at the old pin.

## Compatibility and scope

- Plugin: `@benz-ai-x/dsh-research-graph@0.2.1-alpha.1`; tag `v0.2.1-alpha.1`; npm dist-tag `next` (`latest` stays `0.1.5-rc.1`).
- Target: official DSH `dsh-v0.2.1-alpha.1`, commit `5badb1500908b83c5bf7c00b56ff09e37fbf5a243`. The matching checkout's native/lib/web builds were redone at the tag on 2026-10-07 and verified newer than the tag commit.
- The exact `@deepseek-ai/dsh-llm` peer and all direct DSH dependencies are pinned to `0.2.1-alpha.1`; `@deepseek-ai/cordis` stays `^4.0.2`; `@deepseek-ai/schemastery` is `~3.18.5-alpha.1`.
- Base: main `4a6230a5c8259fde7b17a4855e870f0917d3c241` (merge of [PR #60](https://github.com/benz-ai-x/dsh-research-graph/pull/60), tree verified identical to the accepted head `c1f67f4`; all four checks green on both the adaptation head and the handoff head).
- No persistence schema, bundled recovery dependency, or daily user profile changes. No canvas, layout, or routing code changed, so geometry acceptance was not rerun; the README workbench screenshot was re-captured on this build per release-line practice.
- Upstream `0.2.1-alpha.1` packages were published 2026-10-03 04:35 UTC, so the 24-hour install age window had already closed and every install (local and CI) ran without the `minimum_release_age` bypass.

## Validation

- pnpm **11.7.0** installation, Node.js local / CI matrix 22.19·24·26.
- `pnpm run check`: version policy, strict types, build, **230 tests / 25 files** passed (−1 test / −1 file versus 0.2.0-rc.2.1 is the removed invariant spec).
- Matching `pnpm check:harness` against `dsh-v0.2.1-alpha.1`: all four compiler faces and **348 tests / 23 files** passed. The first round failed only `tests/views.client.spec.tsx` on the stub drift described above — a contract discovery, not a test-semantics change.
- The candidate archive (packed locally, **508106 bytes**, Build ID `local-85e7f70d`) passed the isolated packed-profile acceptance — install, offline recovery before Host boot, startup, persistent research operations, historical Branch continuation, reviewed mixed synthesis, extraction/reuse, export, read-only insights, shutdown, removal — with **19 deterministic fixture model calls**.
- Real-browser isolated preview on the official `dsh-v0.2.1-alpha.1` Host (retained demo profile): the workbench badge reads **Research Graph v0.2.1-alpha.1 · local-85e7f70d**; the Plugins panel reports Current version `0.2.1-alpha.1` sourced from this round's tgz; the Workspace graph renders the layered cards, legend, and session-stats inspector, and the cross-workspace Topic graph renders session and knowledge-card nodes with the reading panel. Research data retained from earlier DSH lines loaded normally. The preview was stopped afterwards and the research data retained.
- The official npm archive verification is recorded under **Published artifact** below.

## Published artifact

Publication is recorded here after the OIDC publish completes.

## Acceptance boundary

Existing manual arrangements remain until **Relayout** (Undo-safe, collapse- and reading-state-preserving); **Fit** adjusts the viewport; Topic arrangements synchronize only through explicit **Save arrangement**. The cold-start observation — an unopened Branch temporarily lacking its durable title and inherited-source summary in native lists — remains unlocated at the Host layer and is not claimed as repaired; the graph itself recovers retained titles and facts through non-activating projection reads, so the phenomenon is not visible to graph users. Arbitrary dense graphs can still have crossings or obstructed terminals; this round changed no geometry and inherits the verified scenarios of 0.2.0-rc.2.1 (two scopes with the 280×120 card constants). The two structured research-direction requirements in [Issue #32](https://github.com/benz-ai-x/dsh-research-graph/issues/32) remain deferred.
