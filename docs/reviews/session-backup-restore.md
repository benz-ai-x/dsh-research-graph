# Session Backup / Restore acceptance

PR: [#94](https://github.com/benz-ai-x/dsh-research-graph/pull/94) · DSH `0.2.2-rc.3` · local feature validation, not a release or deployment.

## Scope

A sidebar Session downloads one native DSH ZIP with a Workspace/title/UTC/short-ID filename. The archive carries complete committed conversation and context events in each `session.v4.jsonl`, Subagent descendants, and referenced attachments. The New Session action restores that ZIP into a chosen Workspace with no model call and no automatic navigation. Existing identical Sessions are skipped; conflicting IDs are never overwritten.

The backup is not a whole-profile snapshot: credentials, model/plugin configuration, Workspace definitions and folders, Research Graph Topic/Knowledge/Branch Origin records, Workspace files, uncommitted tokens, and KV cache are outside scope.

## Review fixes covered

- Native `assistant/attempt` stream attachments are collected and remapped. Missing attachments and a nonempty `attachments-missing.txt` fail before Session writes.
- Source attachment byte lengths and `sha256:` identities are verified; verbatim files must retain their exact digest. Same-length corruption is rejected.
- Successful and retried restores both attach the root Session. A partial first attempt no longer prevents Workspace repair on retry.
- Cancellation and write-stage failures return `partial: true`, completed IDs, `failedSessionId`, and a sanitized error. Raw Host paths are not returned to the browser.
- Workspace filenames use actual membership only; unaccounted Sessions use the localized Ungrouped label.
- Vendored source differences, development source maps, and this acceptance record are included.

## Automated evidence

- `pnpm run check`: **36 files / 302 tests passed**, including attempt-stream attachments, same-length corruption, explicit missing-attachment reports, cancellation IDs, retry attachment repair, error sanitization, collapsed-sidebar behavior, and final `sessions.refresh()` after success, failure, and cancellation.
- `DSH_HARNESS_ROOT=/path/to/deepseek-harness pnpm check:harness`: all four compiler faces and **28 files / 378 tests passed**. The real two-Host round trip compares complete events, descendants, image/file bytes, duplicate import, and restart persistence; disposal aborts and waits for active work.
- Packed archive `.artifacts/benz-ai-x-dsh-research-graph-0.2.2-rc.3.2.tgz`: the original isolated profile completed **19 fixture model calls**. A second clean profile restored the native ZIP with **zero import model calls**, then continued with exactly **one call** whose request contained the backed-up history. Install/removal was clean.

## Browser evidence

The real isolated preview confirmed the saved filename `DSH_workspace-restore-qa_缓存策略的反例验证_20261115T105855Z_121a6f14.zip`, rather than the native Content-Disposition filename. Uploading that backup into the same Workspace reported one identical existing Session without rewriting it. The restore dialog also opened from the collapsed sidebar. Preview and browser tabs were closed; the daily DSH profile was not modified.

## Boundaries

Strict V4 parsing does not silently migrate unrelated or newer formats. Post-validation I/O failures or cancellation can leave partial Sessions and content-addressed attachments because DSH has no cross-Session deletion transaction; outcomes identify the partial state and failed Session instead of claiming full success. Future requests are rebuilt by the current Host and can differ across DSH, plugin, or model versions.
