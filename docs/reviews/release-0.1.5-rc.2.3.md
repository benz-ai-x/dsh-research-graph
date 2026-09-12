# DSH Research Graph 0.1.5-rc.2.3 release acceptance

This revision releases editable Session title suggestions and concise, highlighted Markdown digests from [PR #34](https://github.com/benz-ai-x/dsh-research-graph/pull/34), feature commit `66832569297747c5edf77b8d486b7a03264ade6f`. The user requested release after being informed that browser visual acceptance remains blocked. Release preparation changes only the package version and release documentation.

## Compatibility

- Plugin: `@benz-ai-x/dsh-research-graph@0.1.5-rc.2.3`; tag `v0.1.5-rc.2.3`; npm dist-tag `next`.
- Target: official DSH `dsh-v0.1.5-rc.2`, commit `fb2c4b9e698e30edb738bca4cf0618587db7d203`.
- All direct DSH dependencies remain exactly `0.1.5-rc.2`, with the LLM peer pin as the canonical target. The lockfile and bundled recovery dependencies are unchanged; no new third-party notices are required.
- Both READMEs pin installation to the new plugin revision. Previous releases and tags remain unchanged.

## Validation

- Frozen installation with pnpm 11.7.0 passed.
- `RELEASE_TAG=v0.1.5-rc.2.3 pnpm run check`: strict types, build, and **197 tests / 23 files** passed.
- Matching official RC.2 `check:harness`: all four compiler faces and **295 tests / 17 files** passed. Standalone Host adapters remain outside those compiler programs.
- The Graph header integration test verifies the package-derived version. The packed browser module and manifest both contain `0.1.5-rc.2.3`, with Build ID **local-090a1611**.
- The actual local archive passed isolated web-profile install, offline recovery before Host boot, startup, durable topics/merge/knowledge, extraction, reuse, frozen export, read-only title suggestion, native user-title rename, digest/history/search, exact history ranges, shutdown, and removal. The model transport uses eleven deterministic fixture calls.
- `git diff --check` passed. Release preparation does not alter product behavior relative to the feature commit.

The local archive `benz-ai-x-dsh-research-graph-0.1.5-rc.2.3.tgz` is 443833 bytes, SHA-256 `b6bbfd588958546eaae80b477fa36071af7c86dbd309d0ba0c63125c3abd1a18`. Logs and metadata are in the release worktree's `.artifacts/release-0.1.5-rc.2.3/`. The Publish workflow rebuilds tagged source; these local archive bytes are not claimed to be the later npm artifact. Published bytes are verified and smoke-tested separately before being attached to the Release.

## Included behavior and remaining acceptance

Generate title reads the selected discussion, opens an editable preview, and only writes a native user title when Apply is chosen. Cancellation and selection changes ignore late suggestions; save failure retains the edit. The native Session feed supplies graph and sidebar titles. The preflight title comparison is not an atomic cross-client lock.

Digests use one overview sentence, short unordered findings and open items, with Markdown emphasis, highlighted keywords, inline code and source-backed links. The prompt targets 200–350 Chinese characters or 100–160 English words. Complete output has item/count/total limits; an oversized digest receives at most one compression retry, retaining the 4096-token reasoning/output budget. Failures preserve the prior valid digest.

Chrome returned `ERR_BLOCKED_BY_CLIENT` for the local preview; the user confirmed manual access was also blocked. This release does **not** claim completed browser visual acceptance or real-model quality evaluation. [Issue #33](https://github.com/benz-ai-x/dsh-research-graph/issues/33) remains open for that acceptance; [feature acceptance details](session-insights.md) distinguish automated coverage from the pending checks. Previous screenshots are not evidence for this revision.
