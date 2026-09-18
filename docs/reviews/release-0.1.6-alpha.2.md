# DSH Research Graph 0.1.6-alpha.2 release acceptance

This is the first adaptation of the DSH 0.1.6-alpha.2 line; per the release policy the plugin takes the full target version. The upstream client contract moved in four places, and the plugin follows without behavior changes: Typert codecs materialize schemas lazily through `create()`, the unified `useSessionStatus` feed replaces `useSessionPendingInteraction` (the old `SessionSummary.completed` reminder is now `SessionStatus.completionUnread`, and `SessionSummary` gains required `retainedBy` ownership counts), and session navigation moves from `ctx.sessions.open`/`openSubagent` to `ctx.uiWorkspace.openSession` with direct `SubagentAddress` targets.

## Compatibility and scope

- Plugin: `@benz-ai-x/dsh-research-graph@0.1.6-alpha.2`; tag `v0.1.6-alpha.2`; npm dist-tag `next`.
- Target: official DSH `dsh-v0.1.6-alpha.2`, commit `ddefc45fbc` (merge of the release PR).
- The exact LLM peer and all direct DSH dependencies remain at `0.1.6-alpha.2`.
- Base: main `d999061`; adaptation `a97ff27`, merged by [PR #49](https://github.com/benz-ai-x/dsh-research-graph/pull/49) at `259262bf55303496521d88a964bc40ce7124abf4`; the tag points to that commit.
- CI/publish workflows set `pnpm_config_minimum_release_age=0` with an explanatory comment: pnpm 11.7 lockfile verification ignores the committed `minimumReleaseAgeExclude` entries, and the DSH 0.1.6-alpha.2 packages were still inside the default 24-hour age window at release time. Revert once the verifier honors excludes.
- No persistence schema, bundled recovery dependency, lockfile policy, or daily user profile changes.

## Validation

- Frozen pnpm **11.7.0** installation, Node.js **26.4.0**.
- `RELEASE_TAG=v0.1.6-alpha.2 pnpm run check`: version policy, strict types, build, **227 tests / 26 files** passed.
- Matching `pnpm check:harness` against `dsh-v0.1.6-alpha.2`: all **four source/published Host/Client compiler faces** and **343 tests / 22 files** passed. Standalone declarations are excluded from Harness compiler programs.
- The candidate archive (479584 bytes, Build ID `local-bdc0369a`) passed isolated installation, offline recovery before Host boot, startup, persistent research operations, historical Branch continuation, reviewed mixed synthesis, extraction/reuse, export, read-only insights, shutdown and removal, with **19 deterministic fixture model calls**.
- The official npm archive passed the same isolated packed-profile acceptance with **19 fixed model calls**.

## Published artifact

Publication completed on **2026-09-18 at 02:24:06 UTC** (async PUT 202; visible on npm at 02:29 UTC).

| Official npm artifact | Verified value |
| --- | --- |
| Archive | `benz-ai-x-dsh-research-graph-0.1.6-alpha.2.tgz` |
| Size | 479441 bytes |
| Build ID | `local-0f5ce7dc` |
| SHA-256 | `67ab36751d0f90fce4970ad31d2b3740cb0d54dd2fb28dfdfb871664327992ba` |

The candidate Build ID (`local-bdc0369a`) differed from the official one because an ignored `src/.DS_Store` entered the local input fingerprint; excluding it reproduces `local-0f5ce7dc` exactly, confirming the official bytes match the tagged sources. The file was removed after verification. Registry SHA-1/SHA-512 and provenance metadata matched the repository, tag, merge commit `259262bf`, publish run, and artifact digest (transparency log index 2882406081); certificate signatures were not separately cryptographically verified. The Release archive and `SHA256SUMS` were downloaded again and matched the official bytes. [PR CI](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/35298567640), [main CI](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/35298952458), and [OIDC Publish](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/35298980335) all passed.

Private release evidence lives in `.artifacts/release-0.1.6-alpha.2/`; the official archive and checksums are in `official/`.

## Acceptance boundary

The acceptance boundary is unchanged from [0.1.5-rc.2.8](release-0.1.5-rc.2.8.md): existing manual arrangements remain until **Relayout** (Undo-safe, collapse- and reading-state-preserving); **Fit** adjusts the viewport; Topic arrangements synchronize only through explicit **Save arrangement**. The previously recorded cold-start observation — an unopened Branch temporarily showing a directory-derived title and omitting inherited-source summary facts until native opening — remains unlocated at the Host layer and is not claimed as repaired. Arbitrary dense graphs can still have crossings or obstructed terminals. The two structured research-direction requirements in [Issue #32](https://github.com/benz-ai-x/dsh-research-graph/issues/32) remain deferred.
