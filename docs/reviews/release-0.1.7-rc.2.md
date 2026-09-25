# DSH Research Graph 0.1.7-rc.2 release acceptance

This is the first adaptation of the DSH 0.1.7-rc.2 line; per the release policy the plugin takes the full target version. The rc.1→rc.2 upstream delta touched 3429 files, but no breaking change reaches the plugin's surfaces: the `dsh-llm` message model (`MessageSourceMap`/`createUserMessage`/`BlockAssembler`), the Session Controller client list state (`SessionListState`/`refreshProjections`/`subagentCatalog`), `useSessionStatus`/`SessionSummary`/`ctx.uiWorkspace.openSession`, the Typert codec and `Remote` namespace, the Session format catalogs and `sessionProjectionCache` signatures, the locale/`configForms` injections and Conversation view hooks, and the profile-boot plugin peer enforcement are all unchanged. The two real upstream breaks — `workspace-controller.initializeDefault` losing its request parameter and `AgentPresetRoster` losing `modeSelectionEnabled` — are not referenced by the plugin. The one neighboring behavior change is Host-side: `selectModel` now requires catalog membership (`session/model-unavailable`), so only the bundled test fixtures follow by advertising their fixed model through `listModels`. This release also ships the Session projection facts merged earlier for this line ([PR #53](https://github.com/benz-ai-x/dsh-research-graph/pull/53), previously unreleased): non-activating projection reads on graph entry, card round counts with newest-prompt hover previews, the inspector Session statistics block, and durable-title recovery for never-opened Branches; see [ADR 0017](../adr/0017-session-projection-facts.md) and the [projection facts acceptance](projection-facts.md).

## Compatibility and scope

- Plugin: `@benz-ai-x/dsh-research-graph@0.1.7-rc.2`; tag `v0.1.7-rc.2`; npm dist-tag `next`.
- Target: official DSH `dsh-v0.1.7-rc.2`, commit `477b4f4205` (merge of the release PR); the matching checkout rebuilt native/lib/web at this tag.
- The exact LLM peer and all direct DSH dependencies are pinned to `0.1.7-rc.2`.
- Base: main `eca2770629703fc9673b31880f2ed137e7cc7cdf` (merge of [PR #54](https://github.com/benz-ai-x/dsh-research-graph/pull/54), tree verified identical to the accepted head `908e985`).
- CI/publish workflows temporarily restore `pnpm_config_minimum_release_age=0`: pnpm 11.7 lockfile verification ignores the committed `minimumReleaseAgeExclude` entries, and the DSH 0.1.7-rc.2 packages were still inside the default 24-hour age window at adaptation time (published 2026-09-24 21:58 local). Revert once the window passes, as done for rc.1 in PR #52.
- No persistence schema, bundled recovery dependency, lockfile policy, or daily user profile changes. The `pnpm peers check` cordis `~4.0.4` notice predates this line (upstream vendored Cordis has been 4.0.4 since rc.1) and is not new drift.

## Validation

- Frozen pnpm **11.7.0** installation, Node.js **26.4.0**.
- `pnpm run check`: version policy, strict types, build, **231 tests / 26 files** passed; the release-tag variant `RELEASE_TAG=v0.1.7-rc.2 pnpm run check` passed on the release-prep [PR #55](https://github.com/benz-ai-x/dsh-research-graph/pull/55) (merged as `8bf9f006`, tree verified identical to the accepted head `817568f`).
- Matching `pnpm check:harness` against `dsh-v0.1.7-rc.2`: all **four source/published Host/Client compiler faces** and **347 tests / 23 files** passed. Standalone declarations are excluded from Harness compiler programs. No Harness-side bench adaptation was needed beyond the fixture `listModels` advertisement.
- The candidate archive (501470 bytes, SHA-256 `202fb0111a4737ef71bd6b14884cecc951046c5e78d1e5fb9922ae391fe64ec5`, packed locally rather than by CI) passed isolated installation, offline recovery before Host boot, startup, persistent research operations, historical Branch continuation, reviewed mixed synthesis, extraction/reuse, export, read-only insights, shutdown and removal, with **19 deterministic fixture model calls**. The first smoke round failed because the fixture adapter did not advertise a catalog model; after the `listModels` fix the full acceptance passed.
- In the isolated `pnpm preview:dsh` profile on the official `dsh-v0.1.7-rc.2` Host, a real browser opened a sample discussion and switched to the Graph view: the header badge reads **Research Graph v0.1.7-rc.2 · local-3920560a**; the Workspace graph renders its sample discussions with the round-count badges and the inspector Session statistics block, and the Topic graph「缓存设计：速度与一致性」renders its source and reuse edges with knowledge cards, no page errors observed. The preview reused a profile retained from the 0.1.5 era, which also exercised old-data loading on the rc.2 Host; the empty `workspace`-titled card there is legacy seed data with the known directory-name fallback, not a regression.
- The official npm archive verification is recorded below after publication.

## Published artifact

Publication completed on **2026-09-25 at 02:02 UTC** through the OIDC publish workflow (run [36084548966](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/36084548966)).

| Official npm artifact | Verified value |
| --- | --- |
| Archive | `benz-ai-x-dsh-research-graph-0.1.7-rc.2.tgz` |
| Size | 500593 bytes |
| Build ID | `local-3920560a` |
| SHA-256 | `ea857cdbc1b0c8c3cefa869f820cfdc0f3f167b8bda4790d41730a58a6977746` |

The registry SHA-1 (`91ef68698e16532b085f0501315b057b0e13812b`) and SHA-512 integrity (`sha512-Wzuiyfm+kFF7ICgzNShFqnRsgJPSw8rDrgJ8NIW8pJjFP8efsV3xBBRKBmzsp6jKR7/GOqFonxun/dB9HVXz6w==`) match the official bytes. The SLSA provenance attestation names this repository, `refs/tags/v0.1.7-rc.2`, `.github/workflows/publish.yml`, commit `8bf9f006181ec31f847e5472851e060c2c13d81a`, and publish run [36084548966](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/36084548966), with the archive's SHA-512 as the publish attestation's subject digest (transparency log entry 2948015716; certificate signatures were not separately cryptographically verified). The official archive passed the same isolated packed-profile acceptance with **19 fixed model calls**, and its Build ID `local-3920560a` equals the badge verified in the browser preview. The local candidate archive (501470 bytes, SHA-256 `202fb0111a4737ef71bd6b14884cecc951046c5e78d1e5fb9922ae391fe64ec5`) differed in bytes because it was packed locally rather than by CI — both passed the same acceptance independently. The Release archive and `SHA256SUMS` were uploaded, downloaded again, and matched the official npm bytes exactly; the release body was read back. [PR #54 CI](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/36082842141), [PR #55 CI](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/36084123068), the merged [main CI](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/36084450673), and the OIDC Publish all passed; npm `next` is `0.1.7-rc.2` and `latest` remains `0.1.5-rc.1`.

Private release evidence lives in `.artifacts/release-0.1.7-rc.2/`; the official archive and checksums are in `official/`.

## Acceptance boundary

Existing manual arrangements remain until **Relayout** (Undo-safe, collapse- and reading-state-preserving); **Fit** adjusts the viewport; Topic arrangements synchronize only through explicit **Save arrangement**. The cold-start observation — an unopened Branch temporarily showing a directory-derived title and omitting inherited-source summary facts in native lists — remains unlocated at the Host layer and is not claimed as repaired; since this release the graph itself recovers retained titles and facts through non-activating projection reads, so the phenomenon is not visible to graph users. Arbitrary dense graphs can still have crossings or obstructed terminals. The two structured research-direction requirements in [Issue #32](https://github.com/benz-ai-x/dsh-research-graph/issues/32) remain deferred.
