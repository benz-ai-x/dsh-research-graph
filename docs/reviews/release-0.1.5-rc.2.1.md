# DSH Research Graph 0.1.5-rc.2.1 release acceptance

This release ships the research workbench from [PR #25](https://github.com/benz-ai-x/dsh-research-graph/pull/25), based on merged main `fe740efaf2500c525ea61ec23d57486703180ef2`. It introduces plugin revision numbers so workbench releases can continue on the same DSH prerelease without overwriting an existing package.

## Compatibility and version policy

- Plugin: `@benz-ai-x/dsh-research-graph@0.1.5-rc.2.1`, tag `v0.1.5-rc.2.1`, npm dist-tag `next`.
- Target: official DSH [`dsh-v0.1.5-rc.2`](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.5-rc.2), commit `fb2c4b9e698e30edb738bca4cf0618587db7d203`.
- The exact `@deepseek-ai/dsh-llm` peer pin is the canonical DSH target. The first adaptation can equal that version; subsequent plugin releases for the same prerelease append one positive integer, such as `.1`, then `.2`. The target is never inferred by stripping a numeric suffix.
- All direct DSH dependencies remain `0.1.5-rc.2`. The lockfile, release-age exceptions, bundled recovery dependencies, and third-party notices are unchanged.
- CI checkout selection, all four Harness compiler faces, packed acceptance, and the preview launcher share the same version resolver. Release tags still match the plugin version. Standalone Host adapters remain excluded from Harness compiler programs.
- AGENTS.md and both installation READMEs describe the approved rule. Existing tags, Releases, and npm versions remain immutable. Unpublished local iterations retain generated Build IDs.

## Validation

- Frozen installation passed with pnpm 11.7.0.
- `RELEASE_TAG=v0.1.5-rc.2.1 pnpm run check` passed: strict types, build, and 192 tests across 23 files. Seven release-policy tests cover revision progression, exact target selection, malformed versions, dependency drift, release tags, and CI's pre-install CLI output.
- `DSH_HARNESS_ROOT=/path/to/deepseek-harness-0.1.5-rc.2 pnpm check:harness` passed all four compiler faces and 260 tests across 14 files against the unchanged official checkout with native, library, and web outputs prepared.
- The Graph header test checks the package-derived version. The actual archive's browser module contains `0.1.5-rc.2.1` and Build ID `local-62d0b818`; its manifest and all direct DSH pins were inspected.
- The new archive passed isolated-profile installation, offline recovery execution before Host boot, Host startup, durable topics/merge/knowledge, reviewed extraction, accepted reuse, frozen Markdown export, read-only digest/history/search, exact history ranges, and removal. The ten model calls use deterministic fixtures.
- `git diff --check` passed. Product source is unchanged from merged PR #25; its interaction evidence and screenshots remain in [the workbench acceptance record](research-workbench-acceptance.md).

Local logs and metadata are under `.artifacts/release-0.1.5-rc.2.1/` in the release worktree. The locally tested archive is `benz-ai-x-dsh-research-graph-0.1.5-rc.2.1.tgz`, 411535 bytes, SHA-256 `750cae0bc315c16b1d6af80bd1666407505f4bffe01e72ffb43e0ad60ea07edd`. The Publish workflow rebuilds the tagged source with npm provenance; this hash identifies the local archive, not the later CI-published bytes.

## Included behavior and limits

The workbench offers Graph and Reading views, full knowledge content, exact sources, saved revisions, and follow-up research. Topic navigation preserves reading and canvas position. Cross-workspace merge selects an explicit target workspace, retains source ownership, and retries the same target after a failed send. Accepted material reuse remains tied to its frozen revision, including follow-up discussions outside topic membership. Reading can prefill a new card, edit a chosen revision, and continue research from that displayed revision. The release also includes the actual Remote cancellation-signal parameter fix and its Gateway regression.

This is the merged workbench baseline. The subsequent prototype-fidelity redesign has not started and is not part of this release. Historical-turn branching, the full exploration workflow, multi-source synthesis, semantic knowledge links, and recovery of unsaved text across view replacement or browser restart remain future work. The local preview uses explicitly labeled fixed demo answers.
