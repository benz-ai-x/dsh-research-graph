# DSH Research Graph 0.2.2-rc.3.3 release acceptance

This is the third same-line revision for DSH `0.2.2-rc.3`. The exact `@deepseek-ai/dsh-llm` peer and every direct `@deepseek-ai/dsh-*` dependency remain pinned to DSH `0.2.2-rc.3`. Zod remains `4.6.6`; Node.js remains `>=24.9.0`; Schemastery `~3.19.0` and the Cordis peer `~4.1.0` are unchanged. `fflate` is added for native ZIP restoration and its MIT notice is included.

The matching Host is official `dsh-v0.2.2-rc.3`, commit `38a6a5c965aa99ab525161efb7cc5cf1fe62fced`. The Harness checkout matched that tag during validation, with native/lib/web artifacts prepared there. No compatibility or Session-format migration is included.

## Scope

Feature [PR #94](https://github.com/benz-ai-x/dsh-research-graph/pull/94) adds native Session backup and on-demand restore:

- One ZIP contains complete committed conversation/context events in each `session.v4.jsonl`, Subagent descendants, and referenced attachments. Sidebar filenames use actual Workspace membership, Session title, UTC time, and short ID; native Header/`/export` names also import.
- Restore validates archive structure, strict V4 logs, inherited cuts, attachment coverage and source bytes/`sha256:` identities. It preserves Session IDs, parentage, origin, Agent presets, event content, and inherited prefixes. Existing identical Sessions are skipped; conflicting IDs are never overwritten.
- Restored headers use the chosen Workspace's path. The root is attached after every successful restore, including a retry that repairs an earlier partial attempt. Restore starts no live Agent or model call and does not change the Viewed Session.
- Cancellation and write-stage failures report `partial: true`, completed IDs, the accurate optional `failedSessionId`, and sanitized errors. Missing attachments and preflight conflicts stop before Session writes; later I/O failures do not delete completed records.
- Owner-only bounded upload, Workspace selection, progress/cancel, and list refresh after success/failure/cancellation are included. The browser buffers the ZIP to apply the custom filename.

Profile credentials, model/plugin configuration, Workspace definitions/folders, Research Graph Topic/Knowledge/Branch Origin stores, Workspace files, uncommitted tokens, and KV cache are outside this per-Session backup.

## Candidate validation

- `RELEASE_TAG=v0.2.2-rc.3.3 pnpm run check`: release policy, strict types, build, and **302 tests / 36 files** passed.
- `DSH_HARNESS_ROOT=/path/to/deepseek-harness pnpm check:harness`: all four compiler faces and **378 tests / 28 files** passed, including complete event and attachment comparisons, `assistant/attempt` streams, same-length corruption, retry attachment repair, close-time cancellation, and disposal waiting.
- The candidate archive independently passed isolated installation, offline recovery before Host boot, historical Branch continuation, reviewed extraction/synthesis, acknowledged reuse, frozen export, read-only insights, native title rename, sidebar restart persistence, and removal with **19 deterministic fixture model calls**. A second clean profile restored the native ZIP with **zero import model calls**, then continued with exactly **one call** whose request contained the backed-up history. The report identifies plugin `0.2.2-rc.3.3` and DSH `0.2.2-rc.3`.
- Built-in browser acceptance confirmed badge **`Research Graph v0.2.2-rc.3.3 · local-c699c66d`**, the Workspace graph, the actual Workspace-aware download filename, duplicate-backup skip, and restore dialog in wide and collapsed sidebars. Preview and browser tabs were closed; the daily profile was not changed.
- The README graph image remains the existing fixed demonstration because canvas presentation is unchanged. Feature acceptance is retained in `docs/reviews/session-backup-restore.md`.

Candidate archive: `.artifacts/release-0.2.2-rc.3.3/candidate/benz-ai-x-dsh-research-graph-0.2.2-rc.3.3.tgz`, **776112 bytes**, SHA-256 `0848950c9f722adc6628c3779299bf89ac93034dcf40d3b4bd7f09dd00b90053`, SHA-1 `9beaf576b493f544068d2839d6b8637444657311`; Build ID **`local-c699c66d`**. These are local-candidate values, not official npm artifact values.

## Merge

Feature PR #94 passed Node 24, Node 26, and Matching DSH release CI in [run 43713690222](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/43713690222) and merged as **`91bbb67f4202d4d2e9024345e8483a51f05b5a9e`**. Post-merge [main CI run 43714622009](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/43714622009) passed. Standards and Spec re-reviews found no remaining issues.

## Release boundary

The candidate gates establish local release readiness. Strict V4 parsing does not silently migrate unrelated or newer formats. Post-validation failures can leave partial Sessions and content-addressed attachments because DSH has no cross-Session deletion transaction; outcomes identify partial state instead of claiming success. Future requests are rebuilt by the current Host and can differ across DSH, plugin, or model versions. Real-provider model quality, true multi-device concurrency, arbitrary dense graph routing, and large-scale performance are outside this fixed-fixture acceptance. No deployment is included.

## Publication

Release preparation [PR #95](https://github.com/benz-ai-x/dsh-research-graph/pull/95) passed CI in [run 43719107144](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/43719107144) and merged as **`674a7feb7cb1ce282523b8a92c8770d421c805a1`**. Its merge tree is identical to accepted release head `a87dbdd3e46ef9a06c5ac57425ed45c622b9b978`. Post-merge [main CI run 43719970915](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/43719970915) passed. The annotated tag `v0.2.2-rc.3.3` points to that merge; the [GitHub prerelease](https://github.com/benz-ai-x/dsh-research-graph/releases/tag/v0.2.2-rc.3.3) triggered successful OIDC [Publish run 43720788768](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/43720788768). Registry readback initially reported **`next=0.2.2-rc.3.3`** and **`latest=0.2.2-rc.3.2`**. Following the user's direct-install-latest instruction, `latest` was subsequently promoted to `0.2.2-rc.3.3`; registry readback now reports **`latest=0.2.2-rc.3.3`** and **`next=0.2.2-rc.3.3`**. Package bytes and provenance are unchanged. No deployment is included.

The independently downloaded official npm archive is **775309 bytes**, SHA-256 `baac709c33a62cf5b3f0c8d5eafbe171275f831ca98d1f3df36b6cd4fbd0752b`, registry SHA-1 `463ac85e8404aca86384e83ce4144b1e92293236`, with integrity `sha512-3nGn1w63tT4AdttbGltjX3PsvE04YFQgcQENlyR14meVS61E9kc88UaBG7z69KZFqmwhc3y5tnZNBfu8oURIuQ==`. Its Build ID is **`local-c699c66d`**. The local candidate remains **776112 bytes**, SHA-256 `0848950c9f722adc6628c3779299bf89ac93034dcf40d3b4bd7f09dd00b90053`; candidate and official archives must not be mixed.

SLSA provenance assertions covered the archive subject digest, `refs/tags/v0.2.2-rc.3.3`, commit `674a7feb7cb1ce282523b8a92c8770d421c805a1`, `.github/workflows/publish.yml`, release event, and invocation run `43720788768`; transparency-log entry **`3903385624`** was verified. The official archive independently passed the same isolated packed-profile acceptance with **19 deterministic fixture model calls**, plus **one** continuation call in a second clean profile after a zero-model-call import. The Release archive and `SHA256SUMS` were uploaded, downloaded again, and compared byte-for-byte with the official registry archive. Private verification evidence is retained in `.artifacts/release-0.2.2-rc.3.3/official/`.
