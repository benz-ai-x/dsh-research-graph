# DSH Research Graph 0.1.5-rc.2.2 release acceptance

This revision releases the Session Digest fix from [PR #28](https://github.com/benz-ai-x/dsh-research-graph/pull/28) and the reading/capture UI from [PR #30](https://github.com/benz-ai-x/dsh-research-graph/pull/30), merged at `52778c48a05cd08c6e15217b91f8b2996ed6787a`. Release preparation changes only the package version and release documentation.

## Compatibility

- Plugin: `@benz-ai-x/dsh-research-graph@0.1.5-rc.2.2`; tag `v0.1.5-rc.2.2`; npm dist-tag `next`.
- Target: official DSH `dsh-v0.1.5-rc.2`, commit `fb2c4b9e698e30edb738bca4cf0618587db7d203`.
- All direct DSH dependencies remain exactly `0.1.5-rc.2`, with the LLM peer pin as the canonical target. The lockfile, bundled recovery dependencies, and third-party notices are unchanged.
- Both READMEs pin installation to the new plugin revision and describe the included changes. Existing releases and tags remain unchanged.

## Validation

- Frozen installation with pnpm 11.7.0 passed.
- `RELEASE_TAG=v0.1.5-rc.2.2 pnpm run check`: strict types, build, and **192 tests / 23 files** passed.
- Matching official RC.2 `check:harness`: all four compiler faces and **278 tests / 15 files** passed. Standalone Host adapters remain outside these compiler programs.
- The Graph header integration test verifies the package-derived version. The packed browser module and manifest both contain `0.1.5-rc.2.2`, with Build ID **local-f03d702f**.
- The actual local archive passed isolated web-profile install, offline recovery before Host boot, startup, durable topics/merge/knowledge, reviewed extraction, accepted reuse, frozen Markdown export, read-only digest/history/search, exact history ranges, and removal. The model transport uses ten deterministic fixture calls.
- `git diff --check` passed. Product source is unchanged from the reviewed and merged commits; [reading UX evidence](reading-ux-round.md) and [digest evidence](digest-output-budget.md) remain applicable.

The local archive `benz-ai-x-dsh-research-graph-0.1.5-rc.2.2.tgz` is 432222 bytes, SHA-256 `c75361d495ef4de2340e95401107f1603db6c1689fb8a13a520b6a91b596fce0`. Logs and metadata are kept under `.artifacts/release-0.1.5-rc.2.2/` in the release worktree. The npm Publish workflow rebuilds the tagged source; these local archive bytes are not claimed to be the later published artifact.

## Included behavior and remaining issue

The digest budget defaults to 4096; output-limit failures receive an actionable message and retain a previous digest. Reading uses a draggable Markdown panel with fixed identity and actions, preserving the document position. Completed turns offer nearby knowledge capture with a concrete saved-result notice. Scope, input-session identity, and graph tools share the top context bar; button zoom, fit, locate, and 100% use the same visible-canvas center, while wheel zoom keeps its pointer anchor.

Review retained one nonblocking P3: a Viewed Session with neither Workspace membership nor a working directory still shows “Current directory” in the scope heading. The empty-state message correctly explains the missing scope. This release preserves the reviewed behavior; the wording fix remains a follow-up.
