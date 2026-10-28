# DSH Research Graph 0.2.1-rc.3.1 release-candidate acceptance

This is a same-line revision for DSH `0.2.1-rc.3`. The plugin candidate is `0.2.1-rc.3.1`; the exact `@deepseek-ai/dsh-llm` peer and every direct `@deepseek-ai/dsh-*` dependency remain `0.2.1-rc.3`. The matching Host is official `dsh-v0.2.1-rc.3`, commit `1f81c047fc48fa190a683e469daa699857e9afe8`, with a clean checkout checked before and after the Harness gate.

The review fixed point is local `main` / `20c5a2f6000d828a94508233a9d37712b64342c0`, matching `origin/main` at precheck. The review covers both the commits on `feat/sidebar-session-categories` and the remaining working-tree changes. npm has no published `0.2.1-rc.3.1`, and the remote has no `v0.2.1-rc.3.1` tag at precheck.

## Feature and data scope

- The sidebar has a native-style List/Categories switch and a Workspace → category → Session tree. Workspaces without categories list Sessions directly. Single-assignment moves, create-and-move, deletion back to Uncategorized, drag/drop, undo, search, keyboard navigation, pin/archive actions, and current-Session location are supported.
- `sessionGraphCategories` owns independent Host records in `session_graph_sidebar_categories`, one record per Workspace. Writes validate Workspace membership and available non-Subagent Sessions. Moving and create-and-move are serialized single-record writes; deletion never deletes a Session.
- Existing Workspace-attributed Research Topics are imported once. The original Topics are not modified or deleted, later sidebar edits do not flow back, and Topic Graph behavior remains independent. Legacy-only `workspaceId` create and `delete` commands added during iteration were removed from the Research Topic write API before this candidate.
- Session titles, times, and action slots share the same geometry across direct, categorized, Uncategorized, plain, pinned, running, and current rows. Every row reserves the same status column. Typography matches the native list: `14px / 20px / 400`; relative time is `10px / 16px`.
- The current marker belongs only to the Viewed Session. The currently viewed archived Session remains present even when other archived Sessions are hidden. Workspace/category backgrounds use restrained brand-color tints rather than unrelated colors.
- Category names and membership persist on the Host. List/Categories preference and collapse choices remain browser-local. No canvas geometry, layout, or edge-routing code changed in this work.

## Review findings resolved before the candidate

- Reserving a fixed status column prevents running, pinned, or archived icons from shifting titles relative to plain rows; search results follow the same rule.
- Creating a category from a collapsed Workspace now expands that Workspace so the editor is visible.
- The current archived Session is retained for its current marker instead of being filtered out.
- The obsolete Research Topic sidebar-write extensions were removed; only legacy record reading remains for migration.
- A non-blocking Standards note remains: several collapse-state updates repeat a small copy/mutate/persist sequence and could share a helper later. No correctness issue was found in that repetition, and this release does not expand into a broader refactor.

## Automated and packed-profile validation

- `pnpm install --frozen-lockfile`: passed; `pnpm run check`: strict types, build, **260 tests / 28 files** passed.
- `DSH_HARNESS_ROOT=/Users/pc2026/DSH-Space/deepseek-harness pnpm check:harness`: all four compiler faces and **364 tests / 25 files** passed.
- `RELEASE_TAG=v0.2.1-rc.3.1 pnpm run check`: release-version validation, strict types, build, and **260 tests / 28 files** passed.
- New regression coverage includes current archived visibility, fixed status-column structure, collapsed-Workspace creation, legacy Topic write rejection, first-boot migration and idempotent restart, and packed Sidebar Category CRUD/restart.
- The final `0.2.1-rc.3.1` archive passed isolated installation, offline recovery before Host boot, historical Branch continuation, reviewed extraction/synthesis, acknowledged reuse, frozen export, read-only insights, native title rename, and removal, with **19 deterministic fixture model calls**.
- The packed acceptance also exercises category create, move and reverse move, rename, delete, cross-Workspace rejection, unchanged Topic references, zero model calls for category operations, and a full stop/start of the same isolated profile with `durableSidebarRestart: true`.

Candidate archive: `.artifacts/benz-ai-x-dsh-research-graph-0.2.1-rc.3.1.tgz`, **558532 bytes**, SHA-256 `32265e6bff895f9aad08fc35e0bc1a81d02f6e8901abf1f28d476aba63e1bcef`; Build ID **`local-e8efd216`**. These are local-candidate values, not official npm artifact values.

## Real-browser acceptance

The retained isolated preview serves the final archive on the matching Host. Kimi Code's built-in browser checked native/category round-trip and light/dark presentation. The existing Playwright runtime in the matching Harness supplied DOM geometry and console capture; no dependency was added.

- Badge: **`Research Graph v0.2.1-rc.3.1 · local-e8efd216`**.
- Nine visible Session rows measured one title left edge at **66px**, one time right edge and one action-slot right edge at **273px**. Current marker width is **2px**; marker-to-title spacing is consistent at **27px**, including the reserved status column. Native and category title styles both measure `14px / 20px / 400`.
- Viewports: **1380×1199** desktop and **800×900** narrow. At narrow width DSH collapses to its native icon rail without clipped labels; screenshots were taken after the transition settled.
- Real UI operations passed: create from a collapsed Workspace, rename, HTML drag/drop, Undo, category search with Enter, delete confirmation, and reload with no temporary category left behind.
- Both the geometry run and interaction run captured **0 page errors and 0 console errors**. This is evidence for those browser sessions, not a claim about every possible Host/client session.
- Evidence under `.artifacts/release-0.2.1-rc.3.1/`: `browser-geometry.json`, `browser-interactions.json`, `sidebar-light.png`, `sidebar-dark.png`, `sidebar-narrow.png`, `native-light.png`, and the inspection scripts.

## Release boundary and remaining gates

The local candidate gates above established release readiness. The user then explicitly authorized release and the 8010 upgrade. Feature [PR #74](https://github.com/benz-ai-x/dsh-research-graph/pull/74) passed all four CI jobs in [run 40625794604](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/40625794604) and merged as `f16548049357a436dc7c94c0605561576535ce60`; its merge tree is identical to accepted head `bcfabc944196254ddc6ef3371e9859edf404c7ec`.

Before publication, the remaining workflow is: this release-preparation PR and four green CI jobs, authorized merge, annotated tag and prerelease, OIDC npm publication, then independent official-registry archive verification including integrity/provenance, packed-profile smoke, and Release attachment readback. Those official artifact checks have **not** run and no official checksum is claimed here.

The canvas/layout/routing code is unchanged, so this round does not add a new arbitrary-dense-graph non-overlap guarantee. Previous deferred research features and real-provider quality evaluations remain outside this sidebar revision. The retained preview uses deterministic demo responses, not a real-provider acceptance run; the user's daily DSH profile was not changed.
