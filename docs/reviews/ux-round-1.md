# Research workflow UX — first repair round

This round addresses the eight findings from the UI/UX walkthrough. It changes browser presentation and interaction, preserving the Host APIs, immutable revisions, exact source ranges and explicit send confirmation.

| Finding | Result | Evidence |
| --- | --- | --- |
| Knowledge creation is hidden behind Original selection | Header entries open the card library or a new card directly; expandable guidance explains the source-to-card path | [Overview](../assets/ux-round-1/overview.jpg) |
| Escape loses unsaved work | Close, Escape and Discard edits ask before discarding manual or generated drafts; Keep editing restores focus and content; pending saves remain mounted | [Draft protection](../assets/ux-round-1/draft-protection.jpg) |
| Search entry and card-search copy disagree | Shared search is named for discussions and knowledge; visible content buttons switch the heading and description; the library loads saved cards immediately | [Narrow search](../assets/ux-round-1/search-narrow.jpg) |
| Card forms hide the save action below a long form | Required title and conclusion are prominent; optional details collapse; the save/status bar sticks while scrolling | [Card editor](../assets/ux-round-1/card-editor.jpg) |
| Source previews expose raw transport text | Extraction displays the frozen source title, turns and user/assistant text; reuse displays the question and pinned card revision/content; exact payloads remain expandable and unchanged | [Extraction](../assets/ux-round-1/extraction-preview.jpg), [Reuse](../assets/ux-round-1/reuse-preview.jpg) |
| Empty materials offer no next action | Choose materials opens saved cards and completed source turns inside the composition, preserving the question and ordered selections | [Material picker](../assets/ux-round-1/material-picker.jpg) |
| Topic controls and singleton labels crowd the canvas | Create/rename fields open on demand; selection and sync status share a toolbar; singleton nodes omit duplicate frames; titles use two lines | [Narrow topic](../assets/ux-round-1/topic-narrow.jpg) |
| Control styling and layout-save rules differ | Research controls share Host theme colors, focus rings and primary/secondary actions; topic sync state and local workspace persistence are explained | [English dark theme](../assets/ux-round-1/english-dark.jpg) |

## Validation

- `pnpm run check`: 175 tests across 20 files, strict source type checking and build passed.
- Matching DSH `0.1.5-rc.1` / `dsh-v0.1.5-rc.1`: all four source/published compiler faces and 251 Harness tests across 13 files passed.
- Packed-profile acceptance: install, boot, durable topics/knowledge, reviewed extraction, accepted reuse, frozen Markdown, exact history ranges, read-only search, and removal passed. The fixture uses 10 deterministic model calls, with no paid provider.
- New rendered regressions cover Escape/close/discard confirmation, focus return, in-flight saves, optional field retention, direct card-library discovery, dynamic search labels, and ordered selection of an exact card revision plus an original turn. Existing nested-dialog, retry, source-recovery, arrangement-race and 1,000-reference tests remain green.
- Chrome acceptance used an isolated profile with synthetic discussions, at the normal desktop viewport, 960×900 and 640×820. English/dark and Chinese/light controls were inspected. The 640 px search had a 640 px document width and a 568 px dialog whose scroll width equalled its client width.
- Real browser actions verified new-card save after Keep editing, explicit discard of a later edit, material selection and preview without sending, readable extraction, and generated-draft protection. One deterministic extraction call was made after fixture startup; no paid model was used. Source event prefixes remained structurally identical, allowing only the Host's empty `session/end-seed` on opening a source.

## Scope

Draft protection covers the plugin's close/Escape/discard actions and browser `beforeunload`. Drafts remain in the mounted view; this round does not add durable draft autosave or recovery across arbitrary Host view replacement. Topic layouts retain explicit Host synchronization, with local arrangement drafts. This is a focused workflow and responsive check, not a complete device or accessibility conformance audit.
