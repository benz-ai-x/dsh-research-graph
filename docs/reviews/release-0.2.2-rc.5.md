# DSH Research Graph 0.2.2-rc.5 release acceptance

This is the first Research Graph adaptation for DSH `0.2.2-rc.5`, so the plugin uses the full target version. The exact `@deepseek-ai/dsh-llm` peer and every direct `@deepseek-ai/dsh-*` dependency are pinned to DSH `0.2.2-rc.5`. Zod remains `4.6.6`; Node.js remains `>=24.9.0`; Schemastery `~3.19.0` and the Cordis peer `~4.1.0` are unchanged. No Session-format migration or deployment change is included.

The matching Host is official `dsh-v0.2.2-rc.5`, commit `9c2670d3bce5275e0d1610272958121af87787bb`. The clean Harness checkout was rebuilt at that tag before native/lib/web validation.

## Scope

Adaptation [PR #104](https://github.com/benz-ai-x/dsh-research-graph/pull/104) covers the 13 upstream commits from `dsh-v0.2.2-rc.3` to `dsh-v0.2.2-rc.5`:

- `dsh-llm` adds `CONTENT_REFUSED` for DeepSeek refusals instead of classifying them as `MALFORMED_RESPONSE`. Research Graph retains its generic failure paths; a real `LlmError` Host regression proves Digest refusal is reported as `generation-failed` without automatic retry, failed-result caching, or Session-event writes.
- The Host selects Web search defaults by model route. The plugin does not call `ctx.web` or override that selection. LiveShare changes are outside the plugin dependency surface.
- Session V4, Controller/Query/Projection, Workspace, Typert, Storage, and consumed Client contracts have no source diff requiring runtime adaptation. Vendored sidebar/workspace/default-workspace sources are unchanged, so no re-vendor is included.
- The [compatibility analysis](dsh-0.2.2-rc.5-compatibility.md) records every consumed manifest/import/fixture/build/vendored surface. Two-axis review findings led to complete Directory and Workspace Folder browser evidence, four additional matrix rows, bilingual version documentation, and explicit standalone-versus-Harness test ownership.

## Candidate validation

- `RELEASE_TAG=v0.2.2-rc.5 pnpm run check`: release policy, strict types, build, and **302 standalone tests / 36 files** passed. Harness specs are excluded from this count by `vitest.config.ts`.
- `DSH_HARNESS_ROOT=/Users/pc2026/DSH-Space/deepseek-harness pnpm check:harness`: all four compiler faces and **389 tests / 29 files** passed, including the refusal regression.
- The final release-candidate archive independently passed isolated installation, offline recovery before Host boot, historical Branch continuation, reviewed extraction/synthesis, acknowledged reuse, frozen export, read-only insights, native title rename, sidebar restart persistence, and removal with **19 deterministic fixture model calls**. A second clean profile restored the native ZIP with **zero import model calls**, then continued with exactly **one call**. The report identifies plugin and DSH `0.2.2-rc.5`.
- Real isolated browser acceptance confirmed badge **`Research Graph v0.2.2-rc.5 · local-b7f7a7d4`**, Workspace/Directory/Topic graphs, knowledge/source/original reading, Workspace Folder creation/deletion, and 390px sidebar open/close. The temporary Directory-scope Workspace was recreated at the same path with all three Sessions reattached; the preview was stopped and the daily profile was not changed.

Candidate archive: `.artifacts/release-0.2.2-rc.5/candidate/benz-ai-x-dsh-research-graph-0.2.2-rc.5.tgz`, **789050 bytes**, SHA-256 `eae4e21b301db75d03d46f6a3c1be1e3234ebc962acbe1e0550e046e512b930c`; Build ID **`local-b7f7a7d4`**. These are local-candidate values, not official npm artifact values.

## Merge

PR #104 passed Node 24, Node 26, and Matching DSH release CI in [run 44470600645](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/44470600645) at accepted head `7318e8c11ef006cd9e21c1852ea51386780cc425`, then merged ordinarily as **`5f890f15c959033f32df0b4c5c12a296dbfa9745`**. Its merge tree `64ce547185f6f9974cb85b7a782130fc4c83e9a5` is identical to the accepted head tree. Post-merge [main CI run 44988765483](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/44988765483) passed.

The temporary release-age override reached its documented cleanup window before release. Prerequisite [PR #105](https://github.com/benz-ai-x/dsh-research-graph/pull/105) removes it from CI and Publish after `env -u pnpm_config_minimum_release_age pnpm install --frozen-lockfile` verified all 228 lockfile entries and rebuilt the package without the override. The release-preparation branch is based on that cleanup head.

## Release boundary

The candidate gates establish release readiness. Real-provider model quality, true multi-device concurrency, arbitrary dense graph routing, and large-scale performance are outside this fixed-fixture acceptance. No deployment or npm `latest` promotion is included in this release workflow.
