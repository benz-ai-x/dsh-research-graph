# DSH Research Graph 0.2.1-alpha.5 release acceptance

This is the first adaptation of the DSH `0.2.1-alpha.5` line: per the release policy the plugin takes the full target version (`0.2.1-alpha.5`) and every direct `@deepseek-ai/dsh-*` dependency follows it. It is a compatibility release with no user-facing feature change, developed and accepted in [PR #68](https://github.com/benz-ai-x/dsh-research-graph/pull/68) (merged as `5a41e1c`, tree identical to the accepted head `16256ca`; all four checks green on the PR, first-round green). PR #68 supersedes the unmerged [PR #67](https://github.com/benz-ai-x/dsh-research-graph/pull/67) (closed), whose 0.2.1-alpha.3 adaptation work it carries in full.

The release absorbs upstream's `dsh-v0.2.1-alpha.2..dsh-v0.2.1-alpha.5` span (977 commits over three prereleases) with three substantive contract adaptations, all from the alpha.3 boundary — the alpha.3→alpha.5 delta (125 commits) is purely additive on the plugin's dependency faces:

1. **Historical Branch adoption.** DSH 0.2.1-alpha.3's `session.create` reuse semantics no longer adopt a persisted seeded Session under its named id (a fresh identity is minted instead, leaving the branch child detached from its Workspace). The branch flow now resumes its own persisted seed through `agents.resume` with the Host default model selection and attaches Workspace membership directly; the attach-failure stage, idempotent retry, restart recovery, and single-child invariant are preserved. A first-pass regression where the resumed child's continuation turn ended silently in error (no model selection installed) was caught by the smoke's fixed-model-call count dropping from 19 to 18 and fixed by passing the default selection; the exploration smoke now also asserts every waited turn ends with a completed reason.
2. **Gateway Peer requirement.** Every `typertGateway.invoke` must name its Peer (`assertPeerLive` on `PeerScope.signal`). All harness specs and the real-profile smoke fixtures pass a shared owner Peer; the two minimal hand-built Host fixtures install the `remote-access` service the Gateway now injects.
3. **Declaration surfaces.** `dsh-session-persistence-jsonl` dropped its default export (namespace imports now); the compiler faces gain an explicit toast SlotFactory subpath map, the workspace client re-import, the css-module declaration on the published client face, and a standalone stub for the `agentDefaultModel` Host service. Two tests asserting that a mismatched identity in a `session/workspace-attach-failed` envelope could not be misread as adoption were removed: the new flow attaches directly, so that case is structurally impossible.

For alpha.3→alpha.5 itself no source adaptation was needed: ui-conversation's optional `DraftSnapshot.command` and the new `InputTriggerController.resolveClaim` touch no face the plugin implements, and api-remotes' new plugin-market namespace is unreferenced. `@deepseek-ai/schemastery` stays at the upstream-declared `~3.18.5-alpha.2` (a stable 3.18.5 exists upstream but no dsh package has moved its range); `@deepseek-ai/cordis` stays `^4.0.2`.

## Compatibility and scope

- Plugin: `@benz-ai-x/dsh-research-graph@0.2.1-alpha.5`; tag `v0.2.1-alpha.5`; npm dist-tag `next` (`latest` stays `0.1.5-rc.1`).
- Target: official DSH `dsh-v0.2.1-alpha.5`, commit `1517a4dbca` (native/lib/web rebuilt at the tag; build artifacts verified newer than the tag commit).
- Base: main `5a41e1c` (merge of [PR #68](https://github.com/benz-ai-x/dsh-research-graph/pull/68)).
- The 0.2.1-alpha.5 packages were published 2026-10-16 12:10–12:16 UTC, inside the 24h pnpm supply-chain window, so `ci.yml`/`publish.yml` temporarily carry `pnpm_config_minimum_release_age=0` (remove after 2026-10-17 12:16 UTC); local commands ran with the same override.
- The README workbench screenshot was re-captured on this build (2560×1828, cross-workspace topic graph with a knowledge card reading panel) per release-line practice.

## Validation

- `RELEASE_TAG=v0.2.1-alpha.5 pnpm run check`: version policy, strict types, build, **235 tests / 25 files** passed.
- `DSH_HARNESS_ROOT` `pnpm check:harness` against `dsh-v0.2.1-alpha.5`: all four compiler faces and **350 tests / 23 files** passed — first-round green with no fixture change (the count is 2 below the 0.2.1-alpha.2.1 round because the two structurally-impossible mismatch tests were removed).
- Real-browser isolated preview on the official `dsh-v0.2.1-alpha.5` Host: badge `Research Graph v0.2.1-alpha.5 · local-95aa7c78`; the workspace graph renders retained demo data, and the cross-workspace topic graph with a knowledge card reading panel renders for the README hero.
- The candidate archive passed the isolated packed-profile acceptance: install, offline recovery before Host boot, historical Branch continuation, reviewed synthesis/extraction, acknowledged reuse, frozen export, read-only insights, native title rename, and removal, with **19 deterministic fixture model calls** (`durableMerge: true` among the checks).
- Candidate archive: **515887 bytes**, SHA-256 `0c57e2b0…`, version `0.2.1-alpha.5` on DSH `0.2.1-alpha.5`.

## Published artifact

- [Release](https://github.com/benz-ai-x/dsh-research-graph/releases/tag/v0.2.1-alpha.5) on the merged tag (main `5150bc0`, tree identical to the accepted head `6171da9`); the merge-commit main CI passed and the OIDC [Publish](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/38923191416) succeeded (2026-10-16 23:21 Asia/Shanghai).
- npm dist-tags after publish: `next` = `0.2.1-alpha.5`, `latest` stays `0.1.5-rc.1`. Registry (queried against `registry.npmjs.org`) shasum `5cc2af36f2ee6d0383e6825852ed03f6121deab1`, integrity `sha512-8v1WfWxq+0o7z1RTIz9+l1rvgbahc6WjIRsPsjFeZC9cENwDtA8I3rElyC+zw8yx2DbQ4aOrQ+zor7Na2kZ+DA==`.
- The official archive (**515284 bytes**, SHA-256 `ba1bf49e…`, packed by CI so its bytes differ from the local candidate as in every previous release) passed the same isolated packed-profile acceptance independently — all durable/research checks with **19 fixture model calls**, version `0.2.1-alpha.5` on DSH `0.2.1-alpha.5`.
- SLSA provenance verified from the registry attestations: repository `benz-ai-x/dsh-research-graph`, workflow `.github/workflows/publish.yml`, ref `refs/tags/v0.2.1-alpha.5`, invocation run `38923191416`, subject digest matching the official archive's SHA-512.
- Release attachments (official archive + `SHA256SUMS`) were uploaded, re-downloaded, checksum-verified, and byte-compared against the registry archive; archived locally under `.artifacts/release-0.2.1-alpha.5/official/`.

## Acceptance boundary

This release changes no research-data model, persistence schema, canvas geometry, or Host service behavior; the 0.2.0-rc.2.1 geometry guarantees and all existing arrangement/fit/relayout semantics are unchanged. The deferred items from previous rounds remain: reasoning-effort choice at merge time, very-large-context merges subject to the Host reference budget, and the two structured research-direction requirements in [Issue #32](https://github.com/benz-ai-x/dsh-research-graph/issues/32).
