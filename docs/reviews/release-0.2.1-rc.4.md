# DSH Research Graph 0.2.1-rc.4 release acceptance

This is the first adaptation of the DSH `0.2.1-rc.4` line. Per the release policy, the plugin takes the full target version `0.2.1-rc.4`; the exact `@deepseek-ai/dsh-llm` peer and every direct `@deepseek-ai/dsh-*` dependency follow it. The previous published plugin `0.2.1-rc.3.1` cannot load on rc4 because of the exact peer check.

The matching Host is official `dsh-v0.2.1-rc.4`, commit `504a01a9578abc2c6f1fb896b1dc322c9fe24f66`. Native/lib/web were rebuilt at that tag, and build artifacts were verified newer than the tag commit. The Harness checkout was clean and its HEAD was checked before and after validation.

## Compatibility and scope

Upstream `dsh-v0.2.1-rc.3..dsh-v0.2.1-rc.4` contains 9 commits. The plugin-facing `ui-conversation` delta only changes View-tab tooltip overflow behavior and the More menu label; the injected Conversation header contract used by this plugin is unchanged. Other direct dependency packages have version-only changes. ACP stdout, MCP and DeepSeek Account changes are outside this plugin's direct dependency surface.

No product source, test fixture, persistence schema, canvas geometry, Host service behavior, or Research Topic/Sidebar Category semantics required adaptation. `@deepseek-ai/schemastery` remains `~3.18.5` and the cordis peer remains `^4.0.2`.

## Candidate validation

- `RELEASE_TAG=v0.2.1-rc.4 pnpm run check`: release-version policy, strict types, build, and **260 tests / 28 files** passed.
- `DSH_HARNESS_ROOT=/Users/pc2026/DSH-Space/deepseek-harness pnpm check:harness` against the official rc4 tag: all four compiler faces and **364 tests / 25 files** passed.
- The candidate archive passed isolated installation, offline recovery before Host boot, historical Branch continuation, reviewed extraction/synthesis, acknowledged reuse, frozen export, read-only insights, native title rename, and removal with **19 deterministic fixture model calls**.
- Packed acceptance also verified Sidebar Category CRUD, cross-Workspace rejection, unchanged Research Topics, zero model calls for category operations, and `durableSidebarRestart: true` after a full stop/start of the same isolated profile.
- Real rc4 browser preview confirmed Sidebar Categories, Research Graph entry, badge **`Research Graph v0.2.1-rc.4 · local-cc4a363e`**, and five Session cards with Merge relations after Fit. The isolated preview was stopped; the user's daily local DSH profile was not changed.

Candidate archive: `.artifacts/benz-ai-x-dsh-research-graph-0.2.1-rc.4.tgz`, **558530 bytes**, SHA-256 `6e636255f6c41930822ae26a73ee5b2cd951dadd6e27648b4e10bcd2253bce5c`; Build ID **`local-cc4a363e`**. These are local-candidate values, not official npm artifact values.

## Release boundary

The candidate gates above established local compatibility and release readiness. Compatibility [PR #76](https://github.com/benz-ai-x/dsh-research-graph/pull/76) passed all four CI jobs in [run 40646197139](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/40646197139) and merged as `78cd4c782dade50a5ec0c6fe7db4d6933b6b7ae1`; its merge tree is identical to accepted head `708488c0b5b5f8c16a61f51ab4fada39c43d2fcf`. The remaining release-preparation, publication, and official-registry verification steps are not claimed here.

The canvas/layout/routing code is unchanged, so this release adds no new arbitrary-dense-graph non-overlap guarantee. Previous deferred research features and real-provider quality evaluations remain outside this compatibility revision. No 8010 upgrade was requested or performed for rc4.
