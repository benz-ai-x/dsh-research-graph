# DSH Research Graph 0.2.1-rc.3 release acceptance

This is the first adaptation of the DSH `0.2.1-rc.3` line: per the release policy the plugin takes the full target version (`0.2.1-rc.3`) and every direct `@deepseek-ai/dsh-*` dependency follows it. Upstream `dsh-v0.2.1-rc.1..dsh-v0.2.1-rc.3` is 15 commits (rc.2: DeepSeek Search/Fetch API behind a settings switch, the DeepSeek Flash 1017 badge; rc.3: navigation entry customization, View-tab pins separated from selection, navigation/preset analytics, the official `/models` listing on the API-key route, and the new `web-deepseek-api` package).

Against this plugin's dependency surface the delta is additive except for one contract the plugin's test bench constructs: `ConversationSessionHeaderInjected` now requires View-tab pin state (`hooks.entryPins`, `hooks.entryActions`, `setPinned`, surfaced as `useEntryPins`/`useEntryActions` props). Product code is unchanged; `tests/views.client.spec.tsx` gained three stub props for its header mount. Upstream's other contract additions (`MessageSubmissionState.newSession`, `DraftInitializationOptions.whenDraftExists`, the `conversation.session.header.views.actions` slot, `ui-workspace` blank-reuse-by-preset) are not constructed or called by this plugin, and the faces it does use (`MarkdownText`, `ConvViewProps`/`conversation.view`, merge/remote session) are unchanged. `@deepseek-ai/schemastery` stays `~3.18.5` and the cordis peer stays `^4.0.2`, matching the upstream published ranges.

## Compatibility and scope

- Plugin: `@benz-ai-x/dsh-research-graph@0.2.1-rc.3`; tag `v0.2.1-rc.3`; npm dist-tag `next` (`latest` stays `0.1.5-rc.1`).
- Target: official DSH `dsh-v0.2.1-rc.3`, commit `1f81c047fc` (native/lib/web rebuilt at the tag; build artifacts verified newer than the tag commit).
- Base: main `442e3d0` (merge of [PR #72](https://github.com/benz-ai-x/dsh-research-graph/pull/72), merged on the user's instruction; tree identical to the accepted head `1321f13`; post-merge main CI passed).
- The 0.2.1-rc.3 packages were published 2026-10-23 07:34–07:42 UTC. The 24h pnpm supply-chain window closed 2026-10-24 07:42 UTC; the age-gate exemptions were removed from `ci.yml`/`publish.yml` in [PR #72](https://github.com/benz-ai-x/dsh-research-graph/pull/72) per the PR #52 precedent (the first PR run fired minutes before the window closed and failed on the last-published packages; the rerun after 07:42 UTC passed with no override). Local commands before the window carried `pnpm_config_minimum_release_age=0`.
- The README workbench screenshot was re-captured on this build (2560×1828, cross-workspace topic graph with a knowledge card reading panel) per release-line practice.

## Validation

- `RELEASE_TAG=v0.2.1-rc.3 pnpm run check`: version policy, strict types, build, **235 tests / 25 files** passed.
- `DSH_HARNESS_ROOT` `pnpm check:harness` against `dsh-v0.2.1-rc.3`: all four compiler faces and **350 tests / 23 files** passed (after the header-stub fixture adaptation).
- Real-browser isolated preview on the official `dsh-v0.2.1-rc.3` Host: badge `Research Graph v0.2.1-rc.3 · local-4c10ea42`; the Research Graph tab is present and selected in the new upstream tab row, Chat ↔ Research Graph round-trip works, and the workspace graph renders retained demo data (6 session cards, Merge badges, turns, legend, minimap); the new "More conversation views" control does not affect the plugin view.
- The candidate archive passed the isolated packed-profile acceptance: install, offline recovery before Host boot, historical Branch continuation, reviewed synthesis/extraction, acknowledged reuse, frozen export, read-only insights, native title rename, and removal, with **19 deterministic fixture model calls** (`durableMerge: true` among the checks; the smoke run reported `dshVersion: 0.2.1-rc.3`).
- Candidate archive: **515881 bytes**, SHA-256 (see `.artifacts/release-0.2.1-rc.3/`), version `0.2.1-rc.3` on DSH `0.2.1-rc.3`, Build ID `local-4c10ea42` matching the browser badge.

## Published artifact

- [Release](https://github.com/benz-ai-x/dsh-research-graph/releases/tag/v0.2.1-rc.3) on the merged tag (main `0a7812e`, tree identical to the accepted head `f3f810e`); both post-merge main CI runs passed and the OIDC [Publish](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/40077130753) succeeded (2026-10-24 16:12 Asia/Shanghai).
- npm dist-tags after publish: `next` = `0.2.1-rc.3`, `latest` stays `0.1.5-rc.1`. Registry (queried against `registry.npmjs.org`) shasum `5170bf5c11f15444b4b6f1938072e3e98f38bb27`, integrity `sha512-VowzB93rQQikCuleEtX/Ujtegc47DQicy2GHqF3Cpf0jU10RUuOn+W/nlp/0owQCfBnKa800HG69XKCEasI7lA==`.
- The official archive (**515292 bytes**, SHA-256 `6b5c75c8…`, packed by CI so its bytes differ from the local candidate as in every previous release) passed the same isolated packed-profile acceptance independently — all durable/research checks with **19 fixture model calls**, version `0.2.1-rc.3` on DSH `0.2.1-rc.3`.
- SLSA provenance verified from the registry attestations: repository `benz-ai-x/dsh-research-graph`, workflow `.github/workflows/publish.yml`, ref `refs/tags/v0.2.1-rc.3`, invocation run `40077130753`, subject `pkg:npm/@benz-ai-x/dsh-research-graph@0.2.1-rc.3` with the SHA-512 digest matching the downloaded official archive byte-for-byte; transparency-log entries `3438227643` (SLSA) and `3438255615` (npm publish attestation).
- Release attachments (official archive + `SHA256SUMS`) were uploaded, re-downloaded, checksum-verified, and byte-compared against the registry archive; archived locally under `.artifacts/release-0.2.1-rc.3/official/`.

## Acceptance boundary

This release changes no research-data model, persistence schema, canvas geometry, or Host service behavior; the 0.2.0-rc.2.1 geometry guarantees and all existing arrangement/fit/relayout semantics are unchanged. The deferred items from previous rounds remain: reasoning-effort choice at merge time, very-large-context merges subject to the Host reference budget, and the two structured research-direction requirements in [Issue #32](https://github.com/benz-ai-x/dsh-research-graph/issues/32). The 8020 deployment (ali_code_agent) was not upgraded with this release; that host has its own maintainer and needs a fresh survey before any plugin change there.
