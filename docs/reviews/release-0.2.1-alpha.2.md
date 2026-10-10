# DSH Research Graph 0.2.1-alpha.2 release acceptance

This is the first adaptation of the DSH `0.2.1-alpha.2` version: per the release policy the plugin takes the full target version (`0.2.1-alpha.2`) and every direct `@deepseek-ai/dsh-*` dependency is pinned to it. Upstream `dsh-v0.2.1-alpha.1..dsh-v0.2.1-alpha.2` spans 669 commits; a package-by-package diff of the plugin's actual dependency surface found exactly two contract conflicts:

1. **`SubagentCatalogEntry` gains `mode: 'external'`.** External executions are a new upstream concept — a delegated task executed by an external provider with **no local child Session**, and the upstream `SubagentAddress` union explicitly excludes the mode (the Host's own address resolver skips external entries). The plugin's `openSubagent` previously passed any found entry's mode straight to `openSession`; it now treats an external entry exactly like a missing one (same 'address unavailable' path), the standalone adapter declares the new variant, and the catalog-guard spec gains an `external` case alongside `stale`/`missing`.
2. **Client `SessionProjectionSnapshot.state` gains `'migration-required'`.** The adapter declaration follows. The plugin's existing `state !== 'ready'` guard already keeps catalog reads on the safe path while the Host defers source migration; no behavior change was needed.

Everything else on the surface is additive and needed no plugin change: `fork`/`forkSession` optional `allowMigration`, llm `prepareCall` optional `configure` callback, session-title provider request `currentTitle?` (the plugin only imports `titleProjectionDefinition` in a harness test — still exported), core/session experimental `PluginRecord` machinery, and the Remote `SessionProjectionsValue` discriminated union (the plugin never reads that Remote directly). `@deepseek-ai/schemastery` stays `~3.18.5-alpha.1` (upstream pin unchanged).

## Compatibility and scope

- Plugin: `@benz-ai-x/dsh-research-graph@0.2.1-alpha.2`; tag `v0.2.1-alpha.2`; npm dist-tag `next` (`latest` stays `0.1.5-rc.1`).
- Target: official DSH `dsh-v0.2.1-alpha.2`, commit `d743267388513b2676c4cf5e2bda859586431e33`. The matching checkout's native/lib/web builds were redone at the tag on 2026-10-10 and verified newer than the tag commit.
- The exact `@deepseek-ai/dsh-llm` peer and all direct DSH dependencies are pinned to `0.2.1-alpha.2`; `@deepseek-ai/cordis` stays `^4.0.2`; `@deepseek-ai/schemastery` stays `~3.18.5-alpha.1`.
- Base: main `438baab4d812e530bec966e2410b0fa26f10b3a0` (merge of [PR #62](https://github.com/benz-ai-x/dsh-research-graph/pull/62), tree verified identical to the accepted head `27214db`; all four checks green on both the adaptation and handoff heads, and on the merged main CI).
- No persistence schema, bundled recovery dependency, or daily user profile changes. No canvas, layout, or routing code changed, so geometry acceptance was not rerun; the README workbench screenshot was re-captured on this build per release-line practice.
- Upstream `0.2.1-alpha.2` packages were published 2026-10-09 07:57–08:05 UTC, inside the 24-hour install-age window: this release temporarily restores the workflow-level `pnpm_config_minimum_release_age=0` bypass in `ci.yml`/`publish.yml` (window noted in comments; removal follows the PR #52 precedent after 2026-10-10 08:05 UTC), and local pnpm commands ran with the same exemption.

## Validation

- pnpm **11.7.0** installation (with the age-gate exemption above), Node.js local / CI matrix 22.19·24·26.
- `pnpm run check`: version policy, strict types, build, **230 tests / 25 files** passed (`views.client.spec.tsx` runs under the harness face).
- Matching `pnpm check:harness` against `dsh-v0.2.1-alpha.2`: all four compiler faces and **349 tests / 23 files** passed (+1 test versus 0.2.1-alpha.1 is the new external guard case; first-round green).
- The candidate archive (packed locally, **509732 bytes**, Build ID `local-e0b07f32`) passed the isolated packed-profile acceptance — install, offline recovery before Host boot, startup, persistent research operations, historical Branch continuation, reviewed mixed synthesis, extraction/reuse, export, read-only insights, shutdown, removal — with **19 deterministic fixture model calls**.
- Real-browser isolated preview on the official `dsh-v0.2.1-alpha.2` Host (retained demo profile): the workbench badge reads **Research Graph v0.2.1-alpha.2 · local-e0b07f32**; the Workspace graph renders the five session cards and the cross-workspace Topic graph renders session and knowledge-card nodes. Research data retained from earlier DSH lines loaded normally. The preview was stopped afterwards and the research data retained.
- The official npm archive verification is recorded under **Published artifact** below.

## Published artifact

Publication is recorded here after the OIDC publish completes.

## Acceptance boundary

Existing manual arrangements remain until **Relayout** (Undo-safe, collapse- and reading-state-preserving); **Fit** adjusts the viewport; Topic arrangements synchronize only through explicit **Save arrangement**. Delegated tasks recorded as external executions have no native record to open and now surface the same address-unavailable notice as other unopenable catalog entries. The cold-start observation — an unopened Branch temporarily lacking its durable title and inherited-source summary in native lists — remains unlocated at the Host layer and is not claimed as repaired; the graph itself recovers retained titles and facts through non-activating projection reads, so the phenomenon is not visible to graph users. Arbitrary dense graphs can still have crossings or obstructed terminals; this round changed no geometry and inherits the verified scenarios of 0.2.0-rc.2.1 (two scopes with the 280×120 card constants). The two structured research-direction requirements in [Issue #32](https://github.com/benz-ai-x/dsh-research-graph/issues/32) remain deferred.
