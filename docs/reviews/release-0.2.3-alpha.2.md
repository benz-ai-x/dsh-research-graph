# DSH Research Graph 0.2.3-alpha.2 release acceptance

This is the first Research Graph adaptation for DSH `0.2.3-alpha.2`, so the plugin uses the full target version. The exact `@deepseek-ai/dsh-llm` peer and every direct `@deepseek-ai/dsh-*` dependency are pinned to DSH `0.2.3-alpha.2`. Node.js is `^24.22.3 || >=26.13.1`; Cordis is `~4.2.0-alpha.1`; Schemastery is `~3.20.0-alpha.1`; Zod remains `4.6.6`. Session data remains V4 with no migration or deployment change.

The matching Host is official `dsh-v0.2.3-alpha.2`, commit `4b399c39a6d1479cd84ca591b4d7c88e24d38a96`. Its native, Host/Client declaration, and Web outputs were rebuilt before validation.

## Scope

- Adaptation [PR #110](https://github.com/benz-ai-x/dsh-research-graph/pull/110) merged ordinarily as **`99b64646ab76e80cf8902bdfda009eef6447fe1f`**; its merge tree is identical to final reviewed head `f8c1816441805c5fe2cf485fd1646acecb6a56ff`. Both code-review axes reported zero findings. Post-merge main CI [45103536869](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/45103536869) and the merge-handoff CI [45103727125](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/45103727125) passed.
- Plugin-owned Session Backup/Restore is retired: sidebar download naming, restore dialog, upload route, Remote descriptors, archive validation/writing, attachment restoration, configuration, dedicated tests, and backup-specific smoke stages are removed.
- Native Session Header and `/export` downloads remain Host capabilities. Workspace Folders, same-directory Workspace membership recovery, the New Session HOC, Research Export, historical Branch/Merge recovery, and existing Session/research records retain their ownership boundaries.
- No vendored sidebar/workspace/default-workspace source port was needed; the upstream alpha.1→alpha.2 source diff is empty. The full matrix is [dsh-0.2.3-alpha.2-compatibility.md](dsh-0.2.3-alpha.2-compatibility.md).

## Candidate validation

- `pnpm run check`: **32 files / 278 standalone tests passed** under official Node.js `26.13.1`, including release policy, strict types, and Host/Client/recovery builds.
- Matching Harness: all four compiler faces and **29 files / 391 tests passed**, including 193 real-view tests.
- Candidate archive: `.artifacts/benz-ai-x-dsh-research-graph-0.2.3-alpha.2.tgz`, **759004 bytes**, SHA-256 **`a6fbff2f8696caa275c452a2ecfb84bca177e72dfd6d299b2c7800f509466602`**, Build ID **`local-2bbf59fd`**. These are local-candidate values, not official npm artifact values.
- The final packed candidate passed historical Branch continuation, durable topics/sidebar/Merge/knowledge, reviewed extraction/synthesis, accepted reuse, frozen Markdown, read-only title/Digest/History/Search, restart persistence, and clean install/removal with **19 deterministic fixture model calls**. The retired second-profile backup restoration stage is not included.
- Direct archive inspection found no retired backup service, upload route, Remote, restore/sidebar action, or bundled `fflate`.
- In the isolated real browser, New Session had no Research Graph restore action, and the Session row menu had no Download Session backup action. Native Session Header download produced a valid **20076-byte** ZIP containing `session.v4.jsonl`; `unzip -t` passed. The test download, browser tab, and preview process were removed or stopped.

## Release boundary

The release removes plugin-owned native ZIP restoration and does not claim a replacement restore capability. Real-provider model quality, deployment, arbitrary dense graph routing, full vendored UI re-synchronization, and the previously disclosed real Directory, complete native-row, and 390px scenarios remain outside this acceptance. Publishing uses npm `next`; no `latest` promotion is included.

The temporary CI/Publish `pnpm_config_minimum_release_age=0` override must be removed after **2026-11-23T09:57Z**, followed by an unmodified frozen-install verification.
