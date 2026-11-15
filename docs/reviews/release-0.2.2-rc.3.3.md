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

Release preparation and official npm verification are pending at this stage. This section will record the release PR/merge, tag, OIDC run, official archive digests, provenance, and independent official-package acceptance before completion.
