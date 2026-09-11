# Cross-workspace research Merges with an explicit destination

The user wants to combine a discussion in Workspace A with a discussion in Workspace B. A Research Topic already spans Workspaces on one Host; a Workspace defines where a Session runs, not the extent of the person's research.

For the Research Workbench, a person selects two or three source Sessions and an explicit destination Workspace before confirmation. The target is independent and uses native Harness Session Snapshot references. The Host verifies its canonical Workspace membership and rechecks source identity, archive state, non-blank content, and non-Subagent origin. The existing Merge marker, snapshot boundary, durability barrier, and retry target remain authoritative. Only captured Merge projections create graph relations.

This extends ADR 0003's same-directory requirement only for requests carrying a verified explicit target Workspace. Existing canvas calls without that destination retain their same-directory rule. Removing all directory checks or silently placing the new Session in the first source's Workspace would hide a meaningful execution-context choice, so neither is used.

The confirmation preview identifies sources, source Workspaces, instruction, and destination. Native snapshots are captured when the person confirms, not when this selection preview opens; long histories remain subject to Harness's reference budget. Source project files, tools, and runtime environments are not combined. The result can be placed in A, B, or another available research Workspace; source Sessions remain owned by their original Workspaces.

The workbench keeps the selection and an already-created retry target while its selection dialog is closed. After successful capture, it adds both sources and the target to the selected Research Topic so the many-to-one relationship remains visible. If topic association fails, retry reuses the captured target. This does not introduce cross-Host research or change permissions.
