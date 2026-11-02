# ADR 0019: Replace the sidebar with vendored halves and native Workspace folders

- Status: Accepted
- Date: 2026-11-02
- Supersedes: ADR 0018 (delivery mechanism and data model; 0018's
  Workspace-internal grouping intent carries over unchanged)

## Context

ADR 0018 delivered "sidebar categories" by shadow-registering a custom
`CategoryBrowser` into the `sidebar.workspaces` hole at priority −1. That
approach cannot declare the native sub-holes (row menus, row actions,
leading/hover seats), so every other plugin's native row operations vanished
inside the category view, and the browsing region was the only customizable
part of the sidebar.

The user's requirement: keep the Research Graph canvas untouched, rebuild the
organizing feature **on the official sidebar code**, and own the whole left
sidebar — installing this plugin replaces it; uninstalling restores the
official one.

## Decision

1. **Vendor, don't shadow.** The browser halves of
   `@deepseek-ai/dsh-client-ui-sidebar` (818 lines) and
   `@deepseek-ai/dsh-client-ui-workspace` (6,011 lines) are copied from tag
   `dsh-v0.2.1-rc.5` into `src/client/sidebar/` and `src/client/workspace/`
   (see `VENDORED.md` for provenance, deltas, and the sync checklist). The
   package's bundle patch disables the official `ui-sidebar` and
   `ui-workspace` rows while it is installed; both must go together because
   the shell hard-injects the `uiWorkspace` service the browser half
   provides, and the vendored copy re-provides it.
2. **Folders replace categories, fresh start.** The feature is re-cut as
   *Workspace folders*: virtual, one level deep (Workspace → folder →
   Session), always enabled, created through the Workspace row menu. A new
   Host service (`WorkspaceFoldersService`, storage domain
   `session_graph_workspace_folders`, typert namespace `sessionGraphFolders`)
   owns the records. Old category data is **not** migrated; the
   `session_graph_sidebar_categories` domain stays dormant in existing
   profiles. This supersedes ADR 0018's model; the Topics legacy import and
   the footer view toggle are retired with it.
3. **Native rows keep their seats.** Folder member rows render through the
   same `SessionNodeItem` as native rows, so `sidebar.workspaces.session.*`
   and `sidebar.session.row.*` registrations keep working. Positional drag
   reorder remains native behavior for a Workspace's ungrouped section;
   dragging a row onto a folder header assigns it, and dropping on the
   Ungrouped label removes it.
4. **The canvas is untouched.** `conversation.view` and all canvas code are
   unchanged; the canvas's `uiWorkspace` navigation calls are now served by
   the vendored copy (contract checked by the harness faces).
5. **Breaking change, single package.** Installing or upgrading to this line
   replaces the official sidebar as part of the package. The READMEs say so
   prominently; uninstalling (or pinning the previous version) restores the
   official sidebar. Consequence: a future DSH upgrade that breaks the
   vendored halves also takes the canvas down with the same package — the
   mitigation is `VENDORED.md`'s per-module upstream diff procedure inside
   every `dsh-compat-fix` round.

## Consequences

- Slot contracts must stay faithful: the vendored shell redeclares every
  `sidebar.*` hole, so ui-settings, ui-sidebar-files/terminal/documentpreview,
  and ui-brand-official keep landing (asserted by the harness faces and the
  preview checklist).
- The standalone type face grows structural shims for the vendored import
  surface (`types/deepseek-harness.d.ts`, `types/context.d.ts`,
  `types/vendored-slots.d.ts`); the four harness compiler faces remain the
  drift gate against the real upstream declarations.
- `dsh.client.inject` lists the module-table targets the vendored halves
  consume minus the two vendored packages themselves; the client bundle
  externals match (`tsdown.config.ts`).
- Release line: first release of this architecture is `0.2.1-rc.5.2`.
