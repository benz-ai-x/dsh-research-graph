# DSH Research Graph 0.1.7-rc.1 release acceptance

This is the first adaptation of the DSH 0.1.7-rc.1 line; per the release policy the plugin takes the full target version. The upstream moved in three breaking places, and the plugin follows without behavior changes: the shared `plugin` LLM message source is removed, so the plugin declares its own `dsh-session-graph` kind through `MessageSourceMap` augmentation and the Merge projection accepts the current kind, the V3→V4-migrated `plugin:dsh-session-graph` envelope, and the legacy V3 envelope; the subagent catalog moves from `refreshSubagents`/`subagentsByParent` to `refreshProjections` plus `projectionsBySession` `subagentCatalog` values (entries carry no `kind`, and `mode` gains `'unknown'`); and the Host now enforces peer-version compatibility at profile boot and install, making the pinned `@deepseek-ai/dsh-llm` peer a hard gate. The offline history recovery tool targets the historical Session format catalog — its output stays a V3-generation artifact (the V2→V3 classifier admits only the `plugin` envelope), and the evidence-bound V3→V4 migration runs on the Host boot path.

## Compatibility and scope

- Plugin: `@benz-ai-x/dsh-research-graph@0.1.7-rc.1`; tag `v0.1.7-rc.1`; npm dist-tag `next`.
- Target: official DSH `dsh-v0.1.7-rc.1`, commit `46a7f68b09` (merge of the release PR).
- The exact LLM peer and all direct DSH dependencies remain at `0.1.7-rc.1`; `@deepseek-ai/schemastery` rises to `^3.18.4`, removing a duplicate declaration conflict.
- Base: main `b43d22c`; adaptation merged by [PR #50](https://github.com/benz-ai-x/dsh-research-graph/pull/50) at `959817c1ae2e5cdef2b38d1819d8c7110c5d8efc` (tree verified identical to the reviewed head `f63842e`).
- CI/publish workflows keep `pnpm_config_minimum_release_age=0`: pnpm 11.7 lockfile verification ignores the committed `minimumReleaseAgeExclude` entries, and the DSH 0.1.7-rc.1 packages were still inside the default 24-hour age window at adaptation time. Revert once the verifier honors excludes.
- No persistence schema, bundled recovery dependency, lockfile policy, or daily user profile changes.

## Validation

- Frozen pnpm **11.7.0** installation, Node.js **26.4.0**.
- `RELEASE_TAG=v0.1.7-rc.1 pnpm run check`: version policy, strict types, build, **227 tests / 26 files** passed.
- Matching `pnpm check:harness` against `dsh-v0.1.7-rc.1`: all **four source/published Host/Client compiler faces** and **343 tests / 22 files** passed. Standalone declarations are excluded from Harness compiler programs. Harness-side bench adaptations: the locale plugin injection moved from `settingsScope` to `configForms`, the conversation view gained the `useInspectCall` standard hook, and `cachedSnapshot` dropped its `inheritedEventCount` parameter.
- The candidate archive passed isolated installation, offline recovery before Host boot (writing a V3-generation artifact that the real reader migrates with child evidence), startup, persistent research operations, historical Branch continuation, reviewed mixed synthesis, extraction/reuse, export, read-only insights, shutdown and removal, with **19 deterministic fixture model calls**.
- In the isolated `pnpm preview:dsh` profile on the official `dsh-v0.1.7-rc.1` Host, a real browser opened a sample discussion and switched to the Graph view: the header badge reads **Research Graph v0.1.7-rc.1 · local-65054815**, and the Workspace graph renders its five sample discussions with the Branch/Merge legend, no page errors observed.
- The official npm archive verification is recorded below after publication.

## Published artifact

_Publication pending; filled in after the OIDC publish run._

## Acceptance boundary

The acceptance boundary is unchanged from [0.1.6-alpha.2](release-0.1.6-alpha.2.md): existing manual arrangements remain until **Relayout** (Undo-safe, collapse- and reading-state-preserving); **Fit** adjusts the viewport; Topic arrangements synchronize only through explicit **Save arrangement**. The previously recorded cold-start observation — an unopened Branch temporarily showing a directory-derived title and omitting inherited-source summary facts until native opening — remains unlocated at the Host layer and is not claimed as repaired. Arbitrary dense graphs can still have crossings or obstructed terminals. The two structured research-direction requirements in [Issue #32](https://github.com/benz-ai-x/dsh-research-graph/issues/32) remain deferred.
