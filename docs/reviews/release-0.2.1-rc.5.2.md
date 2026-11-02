# DSH Research Graph 0.2.1-rc.5.2 release acceptance

This is the second same-line revision for DSH `0.2.1-rc.5`. Per the release policy, the plugin appends revision `2` to the previously published `0.2.1-rc.5`; the exact `@deepseek-ai/dsh-llm` peer and every direct `@deepseek-ai/dsh-*` dependency remain pinned to DSH `0.2.1-rc.5`.

The matching Host is official `dsh-v0.2.1-rc.5`, commit `b830ec950faba0a46dda564be3e2d854afed94f1`. The Harness checkout was clean and its HEAD matched that commit before and after validation.

## Scope

Feature [PR #81](https://github.com/benz-ai-x/dsh-research-graph/pull/81) replaces the official `ui-sidebar`/`ui-workspace` rows with this package's vendored browser halves and adds Workspace folders:

- Folders are virtual, single-level, Workspace-owned, Host-persisted, and synchronized between clients through polling and focus refreshes. Creating, renaming, moving, and deleting folders never changes Session ownership, original history, Workspace accounting, or Research Topic membership.
- Folder member rows preserve native Session menus, row actions, leading and hover seats. Search reveals folder members, and the folder containing the current Session opens like a native Workspace group.
- Old Sidebar Category data remains dormant and is not migrated. Uninstalling restores the official sidebar.
- Browser acceptance fixes make folder actions visible, share the Workbench `ActionMenu` close/focus behavior, and keep Save arrangement on one line at narrow widths. Session Graph facts, layout, routing, and canvas geometry are unchanged.
- Vendored provenance, local-delta annotations, bundled notices, bilingual documentation, and canonical Workspace Folder/Ungrouped vocabulary were reviewed through repeated Standards/Spec passes with no remaining findings.

`@deepseek-ai/schemastery` remains `~3.18.5` and the cordis peer remains `^4.0.2`.

## Candidate validation

- `RELEASE_TAG=v0.2.1-rc.5.2 pnpm run check`: release-version policy, strict types, build, and **253 tests / 30 files** passed.
- `DSH_HARNESS_ROOT=/Users/pc2026/DSH-Space/deepseek-harness pnpm check:harness` against the official rc5 tag: all four compiler faces and **360 tests / 25 files** passed.
- The candidate archive independently passed isolated installation, offline recovery before Host boot, historical Branch continuation, reviewed extraction/synthesis, acknowledged reuse, frozen export, read-only insights, native title rename, and removal with **19 deterministic fixture model calls**. The report identifies plugin `0.2.1-rc.5.2` and DSH `0.2.1-rc.5`, with `durableSidebarRestart: true`.
- Built-in browser acceptance covered folder creation, rename/delete and member return, cross-tab synchronization without manual reload, native Session row actions, menu close/Escape/focus recovery, and the 959px layout. Core research flows covered original reading, search, manual and AI capture, revisions, Topic membership, graph arrangement, historical Branch, Merge provenance, material reuse, synthesis, and Markdown export.
- The 8010 deployment upgraded both global Host prefixes from rc.4 to rc.5 and installed the merged candidate archive. pa24 is `0.2.1-rc.5.3`; all other installed plugins are rc.5. The service is active, `127.0.0.1:8010` listens, and startup logs contain no incompatibility or plugin-start failure. Browser inspection confirmed **`Research Graph v0.2.1-rc.5.2 · local-554d9027`**, the Session Graph, pa24 panel, and Workspace folder creation entry without writing real research data. The verification tunnel was closed.

Candidate archive: `.artifacts/benz-ai-x-dsh-research-graph-0.2.1-rc.5.2.tgz`, **707830 bytes**, SHA-256 `57b510e9976b4160427dd9c83430cc00f3b258d701209d84b5a5cf0b73ba9b1d`; Build ID **`local-554d9027`**. These are local-candidate values, not official npm artifact values.

## Merge and deployment

Feature PR #81 passed all four CI jobs in [run 41385217273](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/41385217273) and merged as **`c7611a5197f8cb697a97f3fe4c27ab719ea81467`**; its merge tree is identical to accepted head `f69b9a6083b1bf42f4f14aedcea5cb12e7747c88`. Post-merge [main CI 41391575353](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/41391575353) passed. Deployment documentation commit `2051eb47bb1647e1fe5f85690335ef81b6094329` also passed [main CI 41392850565](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/41392850565).

The deployment backup is `/DSH/24-PA/backups/dsh-20261102T130258`. No npm publication is implied by that deployment.

## Release boundary

The candidate gates establish local release readiness. Real-provider model quality, true multi-device concurrency, and large-scale performance are outside this fixed-fixture acceptance. The 8010 deployment uses the verified merged local candidate, not an official npm archive.

## Publication

Pending release preparation and official-artifact verification.
