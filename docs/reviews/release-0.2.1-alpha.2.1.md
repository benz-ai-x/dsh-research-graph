# DSH Research Graph 0.2.1-alpha.2.1 release acceptance

This is the first same-line revision of the DSH `0.2.1-alpha.2` adaptation: per the release policy the plugin version appends one revision digit (`0.2.1-alpha.2.1`) while every direct `@deepseek-ai/dsh-*` dependency stays pinned at `0.2.1-alpha.2`. It ships [Issue #64](https://github.com/benz-ai-x/dsh-research-graph/issues/64)'s two fixes, developed and accepted in [PR #65](https://github.com/benz-ai-x/dsh-research-graph/pull/65) (merged as `e936ab6`, tree identical to the accepted head `b291641`; all four checks green on the PR, first-round green):

1. **Session Merge model selection.** The workbench dialog and the canvas quick-merge panel gain a shared Host-catalog picker. The default option follows the Host default model and issues no selection (behavior identical to previous releases); a chosen route is installed on the target through `remote.session.selectModel` before the merge instruction is queued and re-applied idempotently on retry (upstream `model/selection` is an append-only durable event). The workbench preview names the route this merge will use.
2. **Merge target rename regression.** DSH 0.2.x clients no longer materialize a Client binding for `sessions.create()`, so a browser-initiated merge failed at `renameTarget` with `has no Client binding`: the target existed but was never named and never received its instruction — the direct cause of the user-visible "merged session never responds". Renaming now goes through `remote.session.rename`, which needs no binding lifecycle. The gap had gone unnoticed because harness view-test mounts always returned a binding and packed smoke exercised the fixture's Host-side rename path.

Upstream merge `submit` eligibility checks only `turn/start` events and the plugin marker, so `model/selection` events on the target affect neither capture nor retry eligibility. Terminal model failures after capture remain natively rendered by upstream ui-chat (`turn-error`); no plugin-side monitoring was added. No research-data model, persistence schema, canvas geometry, or Host service behavior changed.

## Compatibility and scope

- Plugin: `@benz-ai-x/dsh-research-graph@0.2.1-alpha.2.1`; tag `v0.2.1-alpha.2.1`; npm dist-tag `next` (`latest` stays `0.1.5-rc.1`).
- Target: official DSH `dsh-v0.2.1-alpha.2`, commit `d743267388513b2676c4cf5e2bda859586431e33` (unchanged from the 0.2.1-alpha.2 round; matching checkout builds verified then).
- All direct DSH dependencies and the `@deepseek-ai/dsh-llm` peer stay `0.2.1-alpha.2`; `@deepseek-ai/cordis` stays `^4.0.2`; `@deepseek-ai/schemastery` stays `~3.18.5-alpha.1`.
- Base: main `e936ab6` (merge of [PR #65](https://github.com/benz-ai-x/dsh-research-graph/pull/65)).
- Standalone compiler face additions: `types/typert-session-remote.d.ts` (module-level `session` Remote namespace augmentation) and the `@deepseek-ai/dsh-api-session-controller/remote` adapter block in `types/deepseek-harness.d.ts`; the Harness compiler faces resolve the same calls against the checkout's generated declarations and all four faces match.
- The README workbench screenshot was re-captured on this build (2560×1828, cross-workspace topic graph with a knowledge card reading panel) per release-line practice.

## Validation

- `pnpm run check`: version policy (same-line revision), strict types, build, **235 tests / 25 files** passed.
- `DSH_HARNESS_ROOT` `pnpm check:harness` against `dsh-v0.2.1-alpha.2`: all four compiler faces and **352 tests / 23 files** passed (first-round green).
- Real-browser isolated preview on the official `dsh-v0.2.1-alpha.2` Host: both merge entries show the model picker (default option naming `research-prototype/demo`), the preview names the chosen route, and a confirmed merge completes with the correctly named target and a model answer — the same flow failed at renaming before PR #65. Feature acceptance with screenshots: [merge model selection](merge-model-selection.md).
- The candidate archive passed the isolated packed-profile acceptance (install, offline recovery, research operations, fixed model calls); the count and archive details are recorded below.
- Candidate archive: **515321 bytes**, SHA-256 `110f6d2f…`, Build ID `local-2116f713` (fingerprints `package.json`/`tsdown.config.ts`/`src/`), version `0.2.1-alpha.2.1` on DSH `0.2.1-alpha.2`; the isolated profile exercised install, offline recovery before Host boot, historical Branch continuation, reviewed synthesis/extraction, acknowledged reuse, frozen export, read-only insights, native title rename, and removal, with **19 deterministic fixture model calls** (`durableMerge: true` among the checks).

## Published artifact

Publication is recorded here after the OIDC publish completes.

## Acceptance boundary

Merge model selection offers the Host catalog at merge time only; reasoning-effort choice is deferred (the `selectModel` call leaves room for it). Very large merged contexts remain subject to the Host reference budget and surface as retryable snapshot-submission failures; terminal model failures render through the Host's native turn-error node. Existing manual arrangements, Fit/Relayout/Reset semantics, and the 0.2.0-rc.2.1 geometry guarantees are unchanged. The two structured research-direction requirements in [Issue #32](https://github.com/benz-ai-x/dsh-research-graph/issues/32) remain deferred.
