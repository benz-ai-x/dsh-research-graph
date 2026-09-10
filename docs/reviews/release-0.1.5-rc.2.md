# DSH Research Graph 0.1.5-rc.2 release acceptance

This release aligns Research Graph with DSH `0.1.5-rc.2` and includes the first UI/UX repair round from [PR #21](https://github.com/benz-ai-x/dsh-research-graph/pull/21). Its source baseline is `1405d3bcc51860715c03ac89ee418ca5d896faa1`.

## Compatibility

- Matching upstream: [`dsh-v0.1.5-rc.2`](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.5-rc.2), commit `fb2c4b9e698e30edb738bca4cf0618587db7d203`.
- Package version and every direct DSH dependency are exactly `0.1.5-rc.2`. All 15 DSH packages in the lockfile, including the format catalog's Session/Scope/Invariant peers, resolve to this version. Other dependency versions remain unchanged.
- `pnpm-workspace.yaml` has one exact release-age entry per DSH package for RC.2. This avoids pnpm 11.7's first-match behavior shadowing an appended RC.2 entry behind an RC.1 entry.
- Both installation READMEs and the bundled dependency notices describe the matching release. Historical versions and tags remain unchanged.

## Validation

- `pnpm install --frozen-lockfile` passed with pnpm 11.7.0.
- `RELEASE_TAG=v0.1.5-rc.2 pnpm run check` passed: strict source type checking, build, and 175 tests across 20 files.
- The matching official Harness checkout passed `build:native-system`, `build:lib` and `build:web` without source modifications.
- Matching `pnpm check:harness` passed all four compiler faces (Host/Client source and published declarations), followed by 254 tests across 13 files. Standalone Host adapters remain excluded from those compiler programs.
- The registered Graph header test verifies the package-derived version. The packed browser module contains version `0.1.5-rc.2` and Build ID `local-42728b60`.
- The packed archive passed installation, boot, durable topics/merge/knowledge, reviewed extraction, accepted reuse, frozen Markdown export, read-only digest/history/search, exact history ranges and removal in an isolated web profile. All 10 model calls used deterministic fixtures.
- The bundled offline recovery executable runs through the installed profile before Host boot. Its included libraries match the dependency notices.
- `git diff --check` passed. UI interaction evidence for the included repair round is recorded in [the UX acceptance document](ux-round-1.md); this compatibility release does not change product source files.

Local validation logs are under `.artifacts/release-0.1.5-rc.2/` in the release worktree. The local validation archive is `benz-ai-x-dsh-research-graph-0.1.5-rc.2.tgz`, 372027 bytes, SHA-256 `7bf5a5926082eef764e2a6318925847ec01e50e051101b8cdf51f8d5ef5e39c5`. The Publish workflow rebuilds and validates the tagged source before publishing to npm with provenance; the local hash describes the locally tested archive.

## Included user-facing changes

Knowledge Cards and new-card creation are available from the header. Draft close/Escape/discard actions protect unsaved work. Search headings follow the selected content type and restore saved conditions across scope changes. Card forms prioritize the title and conclusion, keep optional fields collapsible and expose sticky save actions. Frozen source and reuse previews are readable, and the material picker selects saved card revisions or exact completed turns. Topic controls, singleton labels, focus styling and narrow layouts are simplified.

Host persistence, immutable revisions, frozen source addresses, explicit send confirmation and retry behavior retain their existing semantics. Draft recovery remains limited to the mounted plugin view and browser unload protection.
