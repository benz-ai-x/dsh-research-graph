# DSH Research Graph 0.2.1-rc.1 release acceptance

This is the first adaptation of the DSH `0.2.1-rc.1` line: per the release policy the plugin takes the full target version (`0.2.1-rc.1`) and every direct `@deepseek-ai/dsh-*` dependency follows it. It is a pure compatibility release: upstream's `dsh-v0.2.1-alpha.5..dsh-v0.2.1-rc.1` delta is the release commit plus the vendor line moving to stable — 355 files change exactly one version line each and no source file moves — so the plugin needed no code adaptation, carried over from [PR #70](https://github.com/benz-ai-x/dsh-research-graph/pull/70) as merged (see below) with only pins and documentation updated.

Version pins: `@deepseek-ai/schemastery` follows the published range to the stable `~3.18.5` (upstream declared `~3.18.5-alpha.2` through alpha.5); `@deepseek-ai/cordis` stays `^4.0.2`, which now resolves to stable 4.0.5. The earlier Host-contract adaptations of the 0.2.1 line (historical Branch adoption through `agents.resume` with the Host default model selection, Gateway owner-Peer invocations, persistence-jsonl namespace imports, compiler-face declaration fixes) are unchanged; the research-data model, persistence schema, canvas geometry, and Host service behavior are untouched.

## Compatibility and scope

- Plugin: `@benz-ai-x/dsh-research-graph@0.2.1-rc.1`; tag `v0.2.1-rc.1`; npm dist-tag `next` (`latest` stays `0.1.5-rc.1`).
- Target: official DSH `dsh-v0.2.1-rc.1`, commit `1600d8a1e1` (native/lib/web rebuilt at the tag; build artifacts verified newer than the tag commit).
- Base: main `02fb755` (merge of [PR #70](https://github.com/benz-ai-x/dsh-research-graph/pull/70), merged on the user's instruction; tree identical to the accepted head `989ad57`; post-merge main CI passed).
- The 0.2.1-rc.1 packages were published 2026-10-17 02:56 UTC, inside the 24h pnpm supply-chain window, so `ci.yml`/`publish.yml` temporarily carry `pnpm_config_minimum_release_age=0` (remove after 2026-10-18 02:56 UTC); local commands ran with the same override.
- The README workbench screenshot was re-captured on this build (2560×1828, cross-workspace topic graph with a knowledge card reading panel) per release-line practice.

## Validation

- `RELEASE_TAG=v0.2.1-rc.1 pnpm run check`: version policy, strict types, build, **235 tests / 25 files** passed.
- `DSH_HARNESS_ROOT` `pnpm check:harness` against `dsh-v0.2.1-rc.1`: all four compiler faces and **350 tests / 23 files** passed — first-round green with no source or fixture change.
- Real-browser isolated preview on the official `dsh-v0.2.1-rc.1` Host: badge `Research Graph v0.2.1-rc.1 · local-7592b188`; the workspace graph renders retained demo data, and the cross-workspace topic graph with a knowledge card reading panel renders for the README hero.
- The candidate archive passed the isolated packed-profile acceptance: install, offline recovery before Host boot, historical Branch continuation, reviewed synthesis/extraction, acknowledged reuse, frozen export, read-only insights, native title rename, and removal, with **19 deterministic fixture model calls** (`durableMerge: true` among the checks).
- Candidate archive: **515882 bytes**, SHA-256 `84d6bbbe…`, version `0.2.1-rc.1` on DSH `0.2.1-rc.1`.

## Published artifact

- [Release](https://github.com/benz-ai-x/dsh-research-graph/releases/tag/v0.2.1-rc.1) on the merged tag; the merge-commit main CI passed and the OIDC Publish succeeded.
- npm dist-tags after publish: `next` = `0.2.1-rc.1`, `latest` stays `0.1.5-rc.1`.
- The official archive (packed by CI so its bytes differ from the local candidate as in every previous release) passed the same isolated packed-profile acceptance independently; registry integrity and SLSA provenance were verified against `registry.npmjs.org`.
- Release attachments (official archive + `SHA256SUMS`) were uploaded and read back; archived locally under `.artifacts/release-0.2.1-rc.1/official/`.

## Acceptance boundary

This release changes no research-data model, persistence schema, canvas geometry, or Host service behavior; the 0.2.0-rc.2.1 geometry guarantees and all existing arrangement/fit/relayout semantics are unchanged. The deferred items from previous rounds remain: reasoning-effort choice at merge time, very-large-context merges subject to the Host reference budget, and the two structured research-direction requirements in [Issue #32](https://github.com/benz-ai-x/dsh-research-graph/issues/32).
