# Vendored sidebar and workspace halves

This package vendors the browser halves of two official DeepSeek Harness
client plugins and ships them inside its own browser bundle. The bundle patch
(`cordis.patch.yml`) disables the official `ui-sidebar` and `ui-workspace`
rows while this package is installed, so the vendored copies below are the
live sidebar. Uninstalling the package restores the official rows unchanged.

## Provenance

| Vendored location | Upstream package | Upstream path |
| --- | --- | --- |
| `src/client/sidebar/**` | `@deepseek-ai/dsh-client-ui-sidebar` | `packages/client/ui-sidebar/src/**` |
| `src/client/workspace/**` | `@deepseek-ai/dsh-client-ui-workspace` | `packages/client/ui-workspace/src/**` |
| `src/client/workspace/default-workspace.ts` | `@deepseek-ai/dsh-api-workspace-controller` | `packages/api/workspace-controller/src/default-workspace.ts` |

Extracted with `git show dsh-v0.2.1-rc.5:<path>` from the Harness checkout
(tag `dsh-v0.2.1-rc.5`, commit `b830ec950faba0a46dda564be3e2d854afed94f1`).
File layout inside the vendored directories mirrors upstream one-to-one so a
future DSH adaptation round can diff each module with
`git diff dsh-v<old>..dsh-v<new> -- <upstream path>` and port changes file by
file. License: MIT (see `THIRD-PARTY-NOTICES.md`).

## Local deltas

Every intentional difference from upstream is marked with a
`Local delta vs upstream` comment in the source. Summary:

- `src/client/workspace/contract/slots.ts` — drops the type-only reference to
  the official `@deepseek-ai/dsh-client-ui-sidebar/client` (this package
  vendors the shell, so the sidebar SlotMap merges come from
  `src/client/sidebar/contract/slots.ts`); adds the `folders` hook and
  `writeFolder` action to `WorkspaceBrowserInjected`.
- `src/client/workspace/index.ts` and `folder-sync.ts` — inject
  `remote.sessionGraphFolders` (this package's own Host service), synchronize
  folder records through polling and window-focus refreshes, and discard stale
  list responses so they cannot overwrite newer writes.
- `src/client/workspace/tree.ts` — `GroupNode` gains `folders`
  (`FolderNode`), `deriveGroups` partitions each Workspace's visible members
  between its folders and the unassigned remainder, and `TreeView` gains
  `expandedFolders` (`folderViewKey`).
- `src/client/workspace/stores.ts` — persisted `folderExpansion` view state
  (optional so pre-folder snapshots hydrate) with `setFolderExpanded`.
- `src/client/workspace/rows/Rows.tsx` — new `FolderRowItem` (header, count,
  rename/delete menu, Session-drag drop target) and `UngroupedLabelRow`
  (loose-section heading and drag-out target); `ProjectRowItem`'s menu gains
  a `createFolder` action.
- `src/client/workspace/rows/WorkspaceBrowser.tsx` — folder rows render inside
  each Workspace group, folder create/rename/delete dialogs, folder reveal on
  search navigation, and Session-drag assignment (drop on a folder header
  assigns; drop on the Ungrouped label removes).
- `src/client/workspace/rows/Rows.module.css` — folder row, count, drop
  highlight, and ungrouped-label styles.
- `src/client/workspace/locales.ts` — `folder.*` dictionary keys (zh is the
  key-set source of truth, as upstream).
- `src/client/index.ts` (this package's entry, not vendored) — mounts the two
  vendored halves as child plugins.

## Semantics

Workspace folders are virtual: assignment never alters Session ownership,
history, or Workspace accounting, and deleting a folder returns its members
to the Workspace's ungrouped section. One level of nesting only
(Workspace → folder → Session). Folders are always enabled — a Workspace
without folders renders the native flat layout — and the row-level native
slot lists (`sidebar.workspaces.session.menu.item`,
`sidebar.workspaces.session.row.action`, `sidebar.session.row.leading`,
`sidebar.session.row.hover`) keep rendering for every Session row, folder
members included. Positional drag reorder stays native behavior for the
ungrouped section; folder members drag onto folder headers to move.

## Upstream sync checklist (per DSH adaptation round)

1. Re-extract the upstream trees at the new tag into a scratch directory and
   diff them against `src/client/sidebar` and `src/client/workspace`,
   excluding the local-delta files' marked sections.
2. Port upstream changes file by file; keep every `Local delta vs upstream`
   hunk intact unless the round's ADR says otherwise.
3. Re-run `pnpm run check`, `check:harness`, and `smoke:harness`; the harness
   faces compile this package against the checkout's real declarations, so
   contract drift fails loudly there.
4. Update the provenance table's tag and commit above.
