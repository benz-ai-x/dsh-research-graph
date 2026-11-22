# DSH Research Graph 0.2.3-alpha.1 release acceptance

This is the first Research Graph adaptation for DSH `0.2.3-alpha.1`, so the plugin uses the full target version. The exact `@deepseek-ai/dsh-llm` peer and every direct `@deepseek-ai/dsh-*` dependency are pinned to DSH `0.2.3-alpha.1`. Zod remains `4.6.6`; Node.js remains `>=24.9.0`; Schemastery `~3.19.0` and the Cordis peer `~4.1.0` are unchanged. Session data remains V4 with no migration or deployment change.

The matching Host is official `dsh-v0.2.3-alpha.1`, commit `d98f5d68519215da48f3002da2cb9c9d2068d81d`. The clean Harness checkout was rebuilt at that tag before native/lib/web validation.

## Scope

- Adaptation [Issue #108](https://github.com/benz-ai-x/dsh-research-graph/issues/108) and [PR #107](https://github.com/benz-ai-x/dsh-research-graph/pull/107) cover the plugin's consumed contracts from `dsh-v0.2.2-rc.5` to `dsh-v0.2.3-alpha.1`. PR #107 merged ordinarily as **`4147d3d294ffbb6e0660214ab6b3f5a9b5fc8f5a`**; its merge tree is identical to final reviewed head `46bc3b4c053443722036671708fb660010ef28d2`. Both code-review axes reported zero findings.
- The new `dsh-client-ui-session-status` package owns `SessionStatusSnapshot`, `useSessionStatus`, and `uiSession.sessionStatus`. The plugin adds the required dependency and injections, and main-view navigation retains the new `conversation` facet.
- Current working-directory projection now precedes original header cwd for Workspace/Directory graph scopes and vendored Session row/hover display. Formal Workspace membership remains authoritative.
- `completionUnread` can mean natural completion or explicit unread. The canvas no longer infers confirmed Completed from that ambiguous field; vendored rows distinguish Unread and Run failed. Session V4, research records, Workspace Folders, historical Branch recovery, Merge provenance, native backup/restore, and offline Merge recovery retain their data boundaries.
- Vendored changes are a targeted compatibility port with marked local deltas and explicit deferred optional features. The full contract matrix is [dsh-0.2.3-alpha.1-compatibility.md](dsh-0.2.3-alpha.1-compatibility.md).
- Final PR CI [45005104307](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/45005104307) and post-merge main CI [45006054389](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/45006054389) passed Node 24, Node 26, and Matching DSH release.

## Candidate validation

- `pnpm run check`: **36 files / 306 standalone tests passed**, including release policy, strict types, and Host/Client/recovery builds.
- `DSH_HARNESS_ROOT=/Users/pc2026/DSH-Space/deepseek-harness pnpm check:harness`: all four compiler faces and **30 files / 394 tests passed**, including 198 real-view tests.
- Regressions cover both current-directory projection levels and header fallback, vendored row directory selection, mainView conversation retention, unread/failed semantics, and real-primitives row/hover labels, companion-state priority, and archived suppression.
- Candidate archive: `.artifacts/benz-ai-x-dsh-research-graph-0.2.3-alpha.1.tgz`, **786191 bytes**, SHA-256 **`52e30ee968148a5091766f2ccc1118a5100c7f83d413d1d29695cfce78423ec5`**, Build ID **`local-cba60f2c`**. These are local-candidate values, not official npm artifact values.
- Packed-profile smoke passed historical Branch continuation, offline recovery, durable topics/sidebar/Merge/knowledge, reviewed extraction/synthesis, accepted reuse, frozen Markdown, read-only title/Digest/History/Search, native backup export, and clean install/removal with **19 deterministic fixture model calls**. A second clean profile restored the native ZIP with zero import model calls, then continued with exactly **one** additional call.
- Scoped real-browser evidence includes Workspace/Topic graphs, knowledge catalog/detail, Original, sidebar collapse/reopen, main Session A→B→A draft isolation/restoration, and Workspace Folder create/delete with the Ungrouped section retained. The [inspected Workspace screenshot](assets/dsh-0.2.3-alpha.1-workspace.png) contains only isolated demonstration data.
- Real Directory rendering, a completed native-row operation, and real 390px verification remain incomplete and are not claimed. A clipboardWrite permission prompt blocked the native-copy attempt, and responsive-device requests were rejected. Automated scenarios are not presented as substitutes.

## Release boundary

The candidate gates establish release readiness under the repository's required standalone, matching-Harness, and packed-profile checks. Real-provider model quality, deployment, arbitrary dense graph routing, full vendored UI re-synchronization, and the three disclosed real-browser scenarios remain outside this acceptance. Publishing uses npm `next`; no `latest` promotion is included.

The temporary CI/Publish `pnpm_config_minimum_release_age=0` override must be removed after **2026-11-23T03:43Z**, followed by an unmodified frozen-install verification.
