---
description: "Research Graph for DeepSeek Harness: organize AI discussions into research topics, traceable knowledge cards, and materials for further research."
kind: "package-bundle"
---

# DSH Research Graph · 研图

[![CI](https://github.com/benz-ai-x/dsh-research-graph/actions/workflows/ci.yml/badge.svg)](https://github.com/benz-ai-x/dsh-research-graph/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40benz-ai-x%2Fdsh-research-graph?logo=npm)](https://www.npmjs.com/package/@benz-ai-x/dsh-research-graph)
[![dsh-plugin](https://img.shields.io/badge/DeepSeek_Harness-dsh--plugin-4D6BFE)](https://github.com/topics/dsh-plugin)
[![GitHub release](https://img.shields.io/github/v/release/benz-ai-x/dsh-research-graph?logo=github)](https://github.com/benz-ai-x/dsh-research-graph/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

English | [中文](README.zh.md)

**Turn AI discussions into traceable, reusable research knowledge in DeepSeek Harness.**

Research Graph (`@benz-ai-x/dsh-research-graph`) adds an interactive **Research Graph** tab to the DeepSeek Harness Web conversation view. Organize discussions across Workspaces into Research Topics, save Knowledge Cards with exact sources, review AI extraction, and use selected materials to start another discussion.

The canvas also shows Session Lineage, movable Branch clusters, Merge provenance, and compact Subagent summaries. Read original discussion or generate on-demand Session Digests while preserving source Session logs.

<p align="center">
  <a href="docs/assets/research-graph/overview.png">
    <img src="https://raw.githubusercontent.com/benz-ai-x/dsh-research-graph/main/docs/assets/research-graph/overview.png" alt="Research Graph for DeepSeek Harness showing research topics, discussion sources, and a Knowledge Card" width="100%" />
  </a>
</p>

<p align="center"><sub>Research Graph rendered with synthetic research data after upgrading from the previous package name.</sub></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@benz-ai-x/dsh-research-graph">npm</a> ·
  <a href="https://github.com/benz-ai-x/dsh-research-graph/releases">Releases</a> ·
  <a href="https://github.com/benz-ai-x/dsh-research-graph/issues">Issues</a> ·
  <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a>
</p>

## Quick start

```sh
dsh plugin --profile web add @benz-ai-x/dsh-research-graph@0.1.5-rc.2
dsh web
```

If `dsh web` is already running, stop it before restarting. Open the one-time authenticated URL printed by the command, enter a non-blank Session, and choose **Research Graph**. Do not share or persist the URL token.

## Compatibility

| Package release | DeepSeek Harness | Node.js | Verification |
|---|---|---|---|
| `@benz-ai-x/dsh-research-graph@0.1.5-rc.2` | `0.1.5-rc.2` | `^22.19.0 || >=24.0.0` | Real Host/Client types, integration tests and packed-profile runtime acceptance |
| `@benz-ai-x/dsh-research-graph@0.1.5-rc.1` | `0.1.5-rc.1` | `^22.19.0 || >=24.0.0` | Real Host/Client types, integration tests, packed-profile runtime and package migration acceptance |
| Previous package: [`v0.1.5-rc.1`](https://github.com/benz-ai-x/dsh-research-graph/releases/tag/v0.1.5-rc.1) | `0.1.5-rc.1` | `^22.19.0 || >=24.0.0` | Real Host/Client types, integration tests, packed-profile runtime acceptance |
| [`v0.1.5-alpha.1`](https://github.com/benz-ai-x/dsh-research-graph/releases/tag/v0.1.5-alpha.1) | `0.1.5-alpha.1` | `^22.19.0 || >=24.0.0` | Real Host/Client types, integration tests, packed-profile runtime acceptance |
| [`v0.1.6`](https://github.com/benz-ai-x/dsh-research-graph/releases/tag/v0.1.6) | `0.1.2-alpha.1`, `0.1.2-alpha.2`, `0.1.2-alpha.3` | `^22.19.0 || >=24.0.0` | CI, real Harness integration, packed-profile add/remove |
| [`v0.1.5`](https://github.com/benz-ai-x/dsh-research-graph/releases/tag/v0.1.5) | `0.1.2-alpha.1`, `0.1.2-alpha.2` | `^22.19.0 || >=24.0.0` | CI, real Harness integration, packed-profile add/remove |

In the DSH-aligned release line, the plugin version exactly matches its target DSH version, including prerelease suffixes: DSH `0.1.5-rc.2` uses plugin `0.1.5-rc.2`. The previous package is `@benz-ai-x/dsh-client-ui-session-graph`; its tags and artifacts keep that name. The research workflow shipped in `0.1.5-rc.1`; `0.1.5-rc.2` adds the first UI/UX repair round, including draft protection, direct material selection and search-scope restoration. The earlier `0.1.5-alpha.1` package retains its original feature set. Historical `v0.1.0`–`v0.1.6` tags remain unchanged. For DSH `0.1.2-alpha.1`–`alpha.3`, keep plugin `0.1.6`; current source does not promise compatibility with those older hosts. Select by the compatibility table, not npm `latest` or plugin version ordering.

This prerelease uses npm tag `next`; the commands below pin the exact matching version. To install a local build, run `pnpm install --frozen-lockfile` and `pnpm pack --pack-destination .artifacts` in this repository, then use `dsh plugin --profile web add /absolute/path/plugin.tgz`.

## Knowledge Cards

In **Research Graph → Original**, select completed turns and choose **Save as Knowledge Card**. Edit the title, question, conclusion, reasons/conditions, open questions, type and draft/confirmed status; optionally choose a Research Topic. Manual creation does not call a model or change the source Session. The header offers **New Knowledge Card** directly and **How to create a Knowledge Card** explains the source workflow. Title is required; question, reasons, type and status are optional details. The save bar stays visible while scrolling.

Cards appear in topic graphs with a distinct Source Relation. Open a card to inspect any saved revision, read its retained excerpt, or check the exact original turns. Unavailable originals remain clearly labelled as retained excerpts. Edits append immutable revisions; a failed save preserves the draft, and retrying it does not create another card. Escape, Close card and Discard edits ask before losing unsaved content, including generated drafts; Keep editing preserves the current form. A pending save stays mounted until it completes. Discarding edits returns to saved content. Drafts are held in the open view, not automatically saved to Host storage.

Open **Knowledge Cards** directly from the header, or use **Search discussions & knowledge** and switch the visible content buttons to search card titles and bodies across this Host or the selected topic. Topic membership is independent of source directories. Removing a card from a topic preserves its content, revisions and sources; search can find and reattach it. Cards live in Host storage and survive browser-cache clearing and Host restart. Reset and Relayout only affect presentation. Each save supports up to 32 sources and 4 MB of source text JSON; reduce the selected range if it exceeds that limit.

A change of graph scope restores the new scope's saved search type and conditions, or its defaults. Returning to an earlier scope restores that scope's last choice, even after opening through **Knowledge Cards**.

Starting another card or extraction from a source reader opens a separate editor. Closing it returns to the earlier card or draft with its edits preserved.

See the [first UX repair round and screenshots](docs/reviews/ux-round-1.md) for interaction and responsive acceptance.

## Reviewed AI extraction

Select completed turns in Original and choose **Extract knowledge**. Preview readable source titles, turns and user/assistant text before generating; **View exact message text** expands the unchanged model payload. The material budget includes only whole turns and lists omitted ranges. Confirm the provider/model and generate drafts. Review each card's question, conclusions, conditions and open questions, then correct its text and citations before saving. Invalid citations are excluded; uncited drafts are marked for verification. A valid citation establishes provenance, not correctness, and raw tool evidence is not inspected.

Generation is cancellable. Generating again appends another batch and preserves existing edits. Extraction source snapshots survive Host restart, so an open draft can still save the same cited text. Generated drafts themselves stay in the open view until saved. Each model call allows up to five drafts, with a 4,096-token output limit and the configured timeout.

See the [batch acceptance and browser screenshots](docs/reviews/issues-6-10-acceptance.md) and [real-model qualitative review](docs/reviews/issues-6-10-model-quality.md) for the complete research workflow and its evidence limits.

## Start a discussion from selected materials

Add a saved card revision or one completed original turn to **Materials**. You can also open **Materials → Choose materials** to select saved card revisions or completed discussion turns without leaving your question. Choose 1–3 items, reorder or remove them, enter a new question and explicitly choose the target Workspace. **Preview message** presents the question, readable material content, card revisions and the 32,000-character total budget. **View exact message text** reveals the unchanged text submitted after confirmation. Card selection includes only card content and source labels; original discussion needs a separate selection. Oversized material and embedded Harness Session references must be edited or removed before sending.

If a submission response is lost, materials stay locked while Research Graph checks the Host's recorded target state. **Check target status** or reopening Materials repeats that check; Retry always uses the same submission. Closing the dialog suppresses late navigation.

If target creation succeeds while the reuse log cannot be saved, Research Graph checks the reserved Session directly and keeps its Open and Retry actions. A failed state check keeps materials locked; retrying after storage recovers uses the same target and message.

Confirming creates an independent Session and sends the frozen preview through native Harness admission. A failed create preserves the materials. If a target exists but sending fails, Open and Retry recover that same target and message identity. **Sent** means the Host acknowledged receipt; inspect the Session for model response status. **Materials used by this Session** reopens the frozen sources, versions and Reuse Relations after later edits, browser-cache clearing or Host restart. Source Workspace ownership and directories remain authoritative in Harness.

## What it adds

| Capability | What you get |
|---|---|
| Visual Session Graph | Branch Lineage, Merge provenance, Session Clusters, and folded Subagent activity in one view |
| Interactive canvas | Drag, snap, collapse, filter, zoom, pan, fit, relayout, reset, locate, and minimap controls |
| Cross-session workflows | Open or branch any Canvas Session and merge immutable snapshots from two or three sources |
| Original discussion | Read user/assistant text by turn in the Inspector, select a completed range, and check its exact source |
| Discussion search | Find body keywords across workspaces, optionally include archived sources, and inspect the exact matching turn |
| Research Topics | Collect Session references across Workspaces, retain archived sources, and save a separate arrangement for each topic |
| Read-only Session Digests | Generate concise overviews, key outcomes, and open items on demand without changing Session logs |

See the [Original discussion browser acceptance record and screenshots](docs/reviews/pr-14-ui-acceptance.md) for paging, source recovery, running turns, and navigation.

### Data and model behavior

| Action | Durable effect | Model use |
|---|---|---|
| Browse or arrange a Workspace/Directory graph | Does not change Session logs; arrangements stay in browser storage | None |
| Organize Research Topics | Saves names, Session references, and explicitly saved arrangements in Host storage; source Sessions remain unchanged | None |
| Read or select discussion | Retains the selection and fallback excerpt only while the reader is open; does not change Session logs | None |
| Search discussion | Uses the Host index and verifies original text; retains temporary result snapshots without changing sources or archive state | None |
| Generate a digest | Keeps a revision-scoped Host-memory cache; does not append a message | One auxiliary request on the Session route or configured fallback |
| Create a branch | Uses the normal Harness branch operation | No additional request from this plugin |
| Merge Sessions | Creates an independent target and durable snapshot provenance; sources remain unchanged | The target processes the queued instruction on its normal route |

## Install

Install the published npm package into the `web` profile:

```sh
dsh plugin --profile web add @benz-ai-x/dsh-research-graph@0.1.5-rc.2
```

Confirm that the resolved profile contains the bundle:

```sh
dsh --profile web --dump-config
```

The output should contain `name: '@benz-ai-x/dsh-research-graph'`.

### Upgrade from the previous package name

The product is now **DSH Research Graph · 研图**, and the repository is `benz-ai-x/dsh-research-graph`. The npm package is now `@benz-ai-x/dsh-research-graph`. If your web profile has `@benz-ai-x/dsh-client-ui-session-graph` installed, stop that profile, then run:

```sh
dsh plugin --profile web remove @benz-ai-x/dsh-client-ui-session-graph
dsh plugin --profile web add @benz-ai-x/dsh-research-graph@0.1.5-rc.2
dsh web
```

Use the same profile and keep its data directory. The package rename preserves the storage identities for Research Topics, Knowledge Cards, Reuse records and canvas positions. Restore any custom plugin settings under the existing `ui-session-graph` patch ID after reinstalling. Install only one package name in a profile.

The published `v0.1.5-rc.1` Git tag and earlier tags retain their original package names. For this package-name migration, use the npm package above or pack the current source into a local archive.

The package contains both the browser plugin and its `cordis.patch.yml` bundle patch. The dsh plugin manager inserts it after the Session, Workspace, locale, renderer, and conversation plugins already supplied by the `web` profile. No manual `cordis.yml` edit is required.

Remove it with:

```sh
dsh plugin --profile web remove @benz-ai-x/dsh-research-graph
```

Restart the target `web` profile after installation or removal. A running process does not watch its profile dependency list.

Session, LLM, and browser runtime services remain owned by the selected dsh profile. The plugin declares its Typert protocol dependency explicitly, with the matching LLM as a peer dependency. The offline recovery command bundles its format catalog and libraries so it also works before the Host starts. All directly referenced `@deepseek-ai/dsh-*` packages are pinned to the plugin version.

## Use the graph

Open a non-blank session and choose **Research Graph** beside the standard conversation tabs. The Viewed Session resolves a named Workspace Scope when possible and otherwise falls back to a Directory Scope.

- A single click chooses the Selected Session and keeps its Branch Lineage emphasized; the closable detail inspector can open that session or create a Branch, and reports when Harness rejects the request. Click blank canvas space or press Escape to clear selection.
- A double click opens the session in its last-used view.
- Dwell on another Canvas Session for a compact preview without replacing the Selected Session inspector.
- Drag nodes or complete cluster frames to arrange the canvas. Alignment guides snap nearby card edges.
- Session Arrangement persistence fails soft. If browser storage is unavailable, denied, corrupt, or full, the live graph continues with automatic geometry instead of failing to render.
- Small connection dots show relationship anchors; they are not drag handles. Branches are neutral solid directed edges, Merge Relations are branded solid directed edges, and Subagent Derivations are dashed.
- Use wheel zoom, background-drag panning, fit, 100%, relayout, reset, Viewed Session location, or the minimap. The minimap appears when content leaves the visible surface and is hidden in narrow containers. Resizing preserves the current content center and scale.
- Filter by title; Enter centers the first match and Escape clears the filter.
- Hover a node or edge to emphasize its Branch Lineage.
- Read the header badge to identify the package version and exact local Build ID; hover it for the full package identity.

Keyboard shortcuts work while the canvas is focused: `+` and `-` zoom, `0` restores 100%, and `1` fits the graph.

## Export research as Markdown

Choose **Export Markdown** on a saved card or Research Topic, select 1–50 cards, then **Preview Markdown**. The Host reads the selected cards' latest saved revisions and freezes their content and exact source ranges. **Download Markdown** writes the same preview bytes; later edits only appear after another preview. Unsaved card edits are not exported, and opening or closing export preserves the current card/extraction editor.

The standalone file contains questions, conclusions, reasons, open questions, kind/status, revision identities and times, readable discussion excerpts with Session identities/titles/times, and a source relation list. Missing/unreadable originals, incomplete ranges, and originals differing from saved sources are marked explicitly. Excerpts cover only selected ranges. Chinese text, multiline content, and embedded code fences are retained. Export calls no model and changes no source records. Files are limited to 8 MB; failures preserve the selection for retry.

## Return to your working position

Reopen Research Graph to restore its pan, zoom, arrangement, selected material, and valid Original page/scroll position. Reopening search restores the conditions and queries the Host again; results are never cached as working state. Missing selections are cleared with a dismissible notice while the valid viewport stays in place, including when the last card leaves a topic empty. A missing topic returns to the topic list.

Source nodes contributed by Knowledge Cards also resume their last valid Original position. Reading a long source or rechecking a selected range preserves both boundaries, so reopening does not shorten it to a normal page. Clicking a source inside a card still opens that revision's exact saved range. If restoring a topic's Original fails to connect, its retained excerpt remains available; retry restores the saved scroll only after the original is verified.

Presentation state belongs to the same browser and is isolated by persistent Host identity, Workspace identity (even when directories match) or Directory Scope, and topic identity. A newly Viewed Session still opens its own scope; choose **Research Topics** explicitly to return to a remembered topic. Reset and Relayout retain their existing meaning and do not delete saved knowledge, sources, or reuse receipts. Clearing browser storage loses working positions and unsaved arrangements, while Host records remain available. Older arrangements without a Host identity are left untouched and are not automatically assigned to the current Host.

## Organize Research Topics

Choose **Research Topics** in the Research Graph header and create a named topic. In a Selected Session's details or a selected discussion search result, choose **Add to Research Topic**, select a topic, and add the source. You can create a topic in that picker too. Topics collect Session references across Workspaces on the same Host; a Session can belong to several topics.

If creation fails, retrying recovers the same topic. If you edit the name before retrying, the revised name must also save before the input clears; another failure keeps that input available for retry.

The topic graph displays source titles and Workspaces, including archived sources and retained references whose source is unavailable. Edges between Sessions require confirmed Branch or Merge facts. Knowledge Cards also show separate Source Relations to their retained discussion sources. Selecting a node shows its source details; **Read original** loads discussion on demand, and **Open Session** explicitly navigates to a listed, non-archived source. Archived sources remain readable here; opening their Session is disabled because the matching Harness does not keep archived Sessions selected. Removing a reference affects that topic alone. It does not delete, move, archive, branch, or merge a source, or send model context.

Drag nodes or clusters and use collapse, relayout, or reset, then choose **Save arrangement**. Each topic has its own Host-persisted arrangement. Reset clears arrangement choices without removing references. Unsaved arrangement edits also survive reopening in the same browser; choose Save arrangement to share them through the Host. Failed saves retain the input and can be retried. Names, membership, and saved arrangements survive a Host restart and are shared by clients connected to that Host. Concurrent edits to the same arrangement use the last successful save.

Topic switching reads Session headers and existing metadata, not all original discussions. A listed source can still fail when its original is opened; the reader reports that failure or unavailability and offers retry. Switching topics, closing the view, or canceling a read prevents late responses from replacing the current result. Ordinary Workspace/Directory Canvas Session eligibility remains unchanged.

See the [Research Topics acceptance record and screenshots](docs/reviews/issue-5-ui-acceptance.md) for cross-Workspace collection, independent arrangements, source recovery, restart persistence, and the 1,000-reference baseline.

The topic toolbar keeps selection and layout sync status together; creation and rename fields open on demand. Workspace arrangements are kept on this device, while **Save arrangement** syncs a topic arrangement to the Host. Singleton clusters show just their node, and long node titles use up to two lines.

## Search discussion history

Choose **Search discussions & knowledge** in the Research Graph header, enter words or a phrase, and select a Workspace, the Viewed Session's directory, or all sessions on this Host. **Include archived** adds archived sources for reading. It does not restore them or add them to the canvas. The existing title filter continues to emphasize Canvas Sessions independently.

Results show the session title, workspace or directory, message time, and a short passage. Each session contributes its latest matching passage from completed direct user/assistant discussion, ordered newest first. Select a result to read its exact turn in the search Inspector; the matching message is marked, and earlier/later discussion remains available. Only **Open session** changes the Viewed Session; native chat scroll positioning is not implied.

The search uses Harness's keyword/phrase index, retaining its punctuation and accent matching: **foo bar** finds **foo-bar**, and **cafe** finds **café**. These rules also apply to Chinese phrases: **修复 foo bar** finds **修复 foo-bar**. Queries containing Chinese characters also check scoped originals for literal substrings, so **知识卡片** can find **通过知识卡片整理研究资料** even when the title differs. Attachments, tools, reasoning, plugin context, and unfinished discussion are excluded. The first index build and Chinese verification across many sessions can take time; cancel or narrow the scope as needed.

Use **Load more results** to continue the same result snapshot. Changing keywords, scope, or archive inclusion clears it and cancels pending work. A failed search or page can be retried; expired results ask you to search again. Result excerpts retain search-time text while the Inspector rechecks the original. Search does not call a model or write source sessions.

If the Viewed Session's graph scope identity changes, such as a directory becoming a named Workspace or the Viewed Workspace disappearing, search restores the new scope's saved conditions or its defaults. The previous scope's keywords remain saved with that scope. If only the explicitly selected search Workspace disappears while the graph scope stays the same, search cancels pending work, clears results and falls back to the available scope while preserving the current keywords.

See the [discussion search browser acceptance record and screenshots](docs/reviews/pr-15-ui-acceptance.md) for Chinese matches, exact turns, archived sources, paging, retry, and cancellation.

<a id="enable-discussion-search"></a>
### Enable discussion search

DSH `0.1.5-rc.2` disables full-text indexing by default. If Research Graph reports **Full-text indexing is not enabled**, add this override to the active profile's `cordis.patch.yml` (for the web profile, `$DSH_HOME/profiles/web/cordis.patch.yml`):

```yaml
- id: session-query-sqlite
  config:
    path: ':memory:'
    openAt: first-search
```

Keep any other profile entries. This replaces that row's whole configuration, so include both keys. Restart the Host and search again. This in-memory index rebuilds after each restart; a durable index requires a writable absolute file path in `path`. To try the same override without changing profile files, save the snippet as `search.patch.yml` and launch `dsh --profile web --patch /absolute/path/search.patch.yml`. Preparing, disabled, failed, and no matches are separate search states.

## Read original discussion

Select a Canvas Session and choose **Original** in the Session Inspector. It opens the latest ten discussion turns. Use **Load earlier discussion** and **Load later discussion** to read adjacent pages; unavailable directions are disabled. Arrow keys and Home/End switch the Inspector tabs.

- Completed turns show direct user and assistant text with their roles. An unfinished turn shows its status and becomes selectable after completion and **Refresh discussion**. Attachments, tool results, reasoning, and plugin-injected context are excluded.
- Select one turn, then another to include the continuous range, including turns on previously loaded pages. If there is a gap, load the intervening turns first. Selecting a checked turn again or **Clear selection** clears the range.
- **Check selected original** reads that exact range again. Session identity and event boundaries identify the source, even when titles or sentences repeat or later turns arrive. Available original text takes precedence over the retained excerpt.
- **Excerpt only** means the original cannot currently be read and only the text retained with this selection is available. The label remains visible while retrying and after a connection failure, until original text is available again. **Source unavailable** means no original or retained excerpt can be shown. Source identity stays visible, and **Retry reading** checks again. An empty readable Session has a separate empty state.
- Reading can be canceled. Closing the Inspector, changing Session, or leaving the reader aborts the pending request; late responses cannot replace a newer selection. Reading never changes the Viewed Session. Choose **Open session** explicitly to continue in Harness; this does not scroll the native chat to a turn.

Reader selections and excerpts are temporary: closing the reader, switching to the digest or another Session, or reloading discards them. Choose **Save as Knowledge Card** explicitly to retain selected sources in a saved revision. Working Position restores the reading location by querying the original again. Reading, selection, refresh, and retry do not call a model or write to the source Session.

Paging limits browser content, but the Host currently inspects one complete Session snapshot for each request. It does not page the underlying log file. Very large individual Sessions can therefore still take time to read.

## Merge Sessions

Choose **Merge sessions** in the canvas toolbar, then select two or three Canvas Sessions in the numbered order shown on their cards. Review or edit the Merge instruction and choose **Create Merge session**.

- Sources must be distinct, non-blank, non-Subagent Canvas Sessions in the same Workspace or working directory.
- Choose every source on the canvas. Merge instructions cannot contain `dsh-session:` references, because Harness reserves them for the exact source snapshot set.
- Harness creates one independent target Session, gives it a source-derived title, and captures each source at an immutable event boundary. The sources and their existing Branch lineages remain unchanged.
- At submission time the Host re-inspects the target and every source instead of trusting browser metadata. It accepts only non-archived, non-blank Canvas Session sources in the target directory, and only an unparented blank target or an exact same-source retry target.
- The target's normal agent loop receives the edited instruction plus canonical Harness Session references. This feature does not choose a separate summary model; the target uses its normal configured model route when it processes the queued request.
- A Merge Session remains its own Session Cluster. Branded Merge Relations show provenance from each source cluster without turning those sources into parents.
- The Session Inspector lists the source titles and capture boundaries for a selected Merge Session. Merge provenance is projected from the target log and checkpointed in Harness's durable Projection Cache, so it survives restart and cold log replay.
- If target creation succeeds but naming, snapshot submission, persistence, or opening fails, the target is preserved. **Try again** reuses that target instead of creating a duplicate; a late capture from the prior attempt is accepted only when its ordered source set matches exactly. Once the Host starts committing a matched capture to durable projection storage, closing the view no longer cancels that commit. **Open target session** remains available for recovery.

Source selection can be cancelled before submission. Once submission starts, the controls stay locked until it succeeds or produces a recoverable error; leaving the view still aborts its browser request. Host capture waiting is also bounded, and a timeout is reported as a retryable snapshot-submission failure.

## Recover historical Merge Sessions

DSH `0.1.5-alpha.1` rejects the historical `session-graph-merge` message source during V0/V1/V2 log migration, preventing the affected Session body from loading. New Merges use the standard `plugin` source. Upgrading the plugin does not automatically repair existing files.

After installing dependencies in this checkout, run the recovery tool on an explicitly selected historical file. The first command validates only; the second creates a separate V3 artifact in an existing output directory:

```sh
node scripts/migrate-merge-history.mjs --input /path/session.v2.jsonl.zstd
node scripts/migrate-merge-history.mjs --input /path/session.v2.jsonl.zstd --output /separate/recovered/session.v3.jsonl.zstd
```

The tool supports plain JSONL, `.zst`, and `.zstd`. It converts only recognized legacy plugin markers, runs the official complete DSH format migration, and validates the current-format output. The source remains unchanged and existing outputs are never overwritten. Input and decompressed data default to a 128 MiB limit, configurable with `--max-bytes`; unknown fields, corrupt data, and truncated lines are rejected. Use normal DSH reading/migration for V3 logs or Sessions without a legacy marker.

To let the Host use a recovered artifact, stop DSH first, then place the validated file as `session.v3.jsonl` or `session.v3.jsonl.zstd` in **that Session's original directory**, preserving the source. If a V3 file already exists, investigate the conflict before proceeding. The tool generates files without scanning or replacing live Sessions. The installed package exposes `dsh-research-graph-migrate`; the earlier `dsh-session-graph-migrate` command remains an alias.

## Generate a Session Digest

Select any non-blank Canvas Session and choose **Generate digest** in the Session Inspector. Generation is never automatic and never blocks **Open session** or **New branch**.

- The Host inspects the exact Selected Session, even when it is not the Viewed Session. It keeps direct user messages and final assistant text, but excludes reasoning, tool results, and plugin-injected context.
- Model input is capped at 32 KiB. Long sessions retain the initial user goal, latest compaction checkpoint, and as many recent turns as fit.
- The auxiliary request uses no tools and asks for structured output: a concise overview, key outcomes, and open items. It uses the Session's latest logged provider/model route; an optional configured route is only a fallback.
- A digest generated while the Session is running is labeled **Running snapshot**. New activity marks the visible digest **Session has new content** without hiding it; choose **Update digest** to replace it.
- Successful results are cached in Host memory by Session and source revision. **Regenerate** bypasses that cache. Empty or failed results are not cached as successful digests and can be retried.
- Concurrent requests for the same revision share one model call without sharing caller cancellation. Plugin shutdown stops new digest work, cancels owned work, and waits for admitted requests to settle before removing the service.

This is an additional model request and may incur the selected provider's normal cost. Digest text is a read-only projection: it is not a conversation message, does not enter the Session log, and does not change Session Lineage.

Most sessions need no configuration because their logs record the model route. For older imported sessions without one, overlay the installed plugin entry in the profile's `cordis.yml`:

```yaml
- id: ui-session-graph
  config:
    provider: deepseek-official
    model: deepseek-v4-flash
    maxOutputTokens: 800
    timeoutMs: 60000
```

`provider` and `model` must be supplied together and never override a route recorded by the Session. `maxOutputTokens` defaults to `800`; `timeoutMs` defaults to `60000`. Plugin activation validates this configuration through its exported Standard Schema and rejects blank routes, incomplete pairs, non-integers, and non-positive limits.

## Troubleshooting

| Symptom | Check first |
|---|---|
| **Research Graph** tab is missing | Restart `dsh web`, open a non-blank Session, and verify the package appears in `dsh --profile web --dump-config` |
| Host startup fails around a Remote error export | Install the plugin matching DSH in the compatibility table and check the resolved profile version |
| GitHub source install reports `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED` | Inspect the pinned source, add the exact key printed by dsh to that profile's `allowBuilds`, and retry |
| Digest generation reports no model route | Use a Session with a logged route or configure the `provider` and `model` fallback pair |
| The Web URL rejects access | Open the complete authenticated URL printed by `dsh web`; do not reuse or share a stripped token |

If the problem persists, include the package version shown in the Research Graph header, the Harness version, and the relevant Host/browser error in a [GitHub issue](https://github.com/benz-ai-x/dsh-research-graph/issues/new).

## Develop and contribute

Requirements are Node.js `^22.19.0 || >=24.0.0` and pnpm `11.7.0`.

```sh
pnpm install --frozen-lockfile
pnpm run check
```

`pnpm run check` type-checks the standalone package, builds the Host and browser entries, and runs the package-owned test suite. To run the Host and full-interaction integration suite against a prepared DeepSeek Harness checkout:

```sh
pnpm --dir /path/to/deepseek-harness run build:native-system
pnpm --dir /path/to/deepseek-harness run build:lib
DSH_HARNESS_ROOT=/path/to/deepseek-harness pnpm check:harness
```

Read [`CONTEXT.md`](CONTEXT.md) for the domain model and [`docs/adr/`](docs/adr/) for durable design decisions before changing Session, Merge, Digest, or persistence behavior. Setup or behavior changes must update both this file and [`README.zh.md`](README.zh.md). Start user-visible work from a [GitHub issue](https://github.com/benz-ai-x/dsh-research-graph/issues).

`check:harness` requires matching Host and plugin versions. It checks both source and published declarations for Host and Client against that checkout's built public declarations, excluding the standalone Host adapters, then runs real Session, persistence, historical recovery, and UI integration tests. CI runs standalone checks on Node.js 22.19, 24, and 26 and selects `dsh-v<version>` from `package.json`. Packed acceptance installs the archive in a scratch `web` profile, boots the real Host, verifies durable Merge and read-only Digest/History behavior, then removes the plugin. History reads also pass through the same RPC Gateway used by the browser, covering transport-supplied cancellation. Only model transport uses fixed responses.

Build an installable archive with:

```sh
pnpm pack --pack-destination .artifacts
pnpm --dir /path/to/deepseek-harness run build:web
DSH_HARNESS_ROOT=/path/to/deepseek-harness pnpm smoke:harness
```

Local builds derive a stable `local-<hash>` Build ID from `package.json`, `tsdown.config.ts`, and `src/`. Release automation can replace it by setting `DSH_SESSION_GRAPH_BUILD_ID` while building.

### Release

The [Publish workflow](.github/workflows/publish.yml) accepts a published GitHub Release or a manually supplied existing tag. It requires the tag to equal `v` plus the package version, reruns `pnpm run check`, packs the archive, and publishes those verified bytes under npm tag `latest` for stable versions or `next` for prereleases.

The package uses an [npm trusted publisher](https://docs.npmjs.com/trusted-publishers/) for organization `benz-ai-x`, repository `dsh-research-graph`, workflow `publish.yml`, environment `npm-publish`, and the `npm publish` action. The workflow authenticates with GitHub OIDC and must not receive a long-lived `NPM_TOKEN`; keep the GitHub environment as the deployment boundary. When bootstrapping a different package or scope, use a narrowly scoped, short-lived token only for the first publication, configure trusted publishing immediately, and then revoke the token.

For every adaptation release, set `package.json.version` and direct DSH dependencies to the full target DSH version. The plugin tag is `v<version>` and the upstream tag is `dsh-v<version>`. `check-version.mjs` rejects mismatched dependencies or release tags; `check:harness` rejects a mismatched Host version. Before release, pass `pnpm run check`, `check:harness`, and packed-profile acceptance, verify the Research Graph badge reads the same version, then merge and create the immutable tag and Release. Use Build IDs for local iterations against the same DSH version; never overwrite published versions or rename historical tags.

The package exports two Node-facing entries and one lazy browser module. Every JavaScript entry ships a matching TypeScript declaration in the packed archive:

| Export | Purpose |
|---|---|
| `.` | Cordis Host services for Session Digest generation and durable Session Merge submission |
| `./invariant` | Runtime registration invariant |
| `./client` | Built dsh client module |
| `./cordis.patch.yml` | Profile bundle patch |

## Implementation

`GraphView` reads the Viewed Session, Workspace membership, session summaries, and pending-interaction map. Indexed pure helpers derive Session Clusters, Branch and Merge edges, Subagent Summaries, cross-cluster ordering, layout, snapping, Title Filter matches, and viewport state. A separate presentation pipeline applies node positions, collapse state, and cluster offsets before `GraphCanvas` renders the result. The Host exposes separate package-owned Remotes for read-only Session Digests and atomic Session Merge capture. Merge submission revalidates Host truth, queues an explicit marker and canonical references, waits for the matching projection, then writes the Projection Cache before reporting success.

| File | Responsibility |
|---|---|
| [`src/research-topics-host.ts`](src/research-topics-host.ts) | Host storage, serialized topic writes, lightweight source metadata, and lifecycle cancellation |
| [`src/client/ResearchTopics.tsx`](src/client/ResearchTopics.tsx) and [`src/client/TopicGraph.tsx`](src/client/TopicGraph.tsx) | Topic creation, selection, membership, arrangement drafts, and source inspection |
| [`src/client/GraphView.tsx`](src/client/GraphView.tsx) | Workspace/Directory Scope resolution, graph derivation, and view header |
| [`src/client/GraphCanvas.tsx`](src/client/GraphCanvas.tsx) | Canvas rendering, ports, inspector, controls, gestures, hover state, and minimap |
| [`src/config.ts`](src/config.ts) | Exported Standard Schema, defaults, and normalized Host configuration |
| [`src/index.ts`](src/index.ts) | Session Digest and Session Merge Host services, projection registration, configuration, and Remote errors |
| [`src/session-digest.ts`](src/session-digest.ts) and [`src/session-digest-harness.ts`](src/session-digest-harness.ts) | Event filtering, input budgeting, route reconstruction, output validation, revision cache, and concurrency control |
| [`src/session-merge.ts`](src/session-merge.ts), [`src/session-merge-host.ts`](src/session-merge-host.ts), and [`src/session-merge-harness.ts`](src/session-merge-harness.ts) | Browser workflow, Host validation, canonical reference submission, bounded capture, idempotent retry, and durability barrier |
| [`src/session-merge-projection.ts`](src/session-merge-projection.ts) | Versioned Merge marker/reference projection and strict persisted-state validation |
| [`src/session-history-host.ts`](src/session-history-host.ts) and [`src/session-history-codec.ts`](src/session-history-codec.ts) | Read-only discussion paging, exact event boundaries, and shared strict wire validation |
| [`src/client/SessionHistory.tsx`](src/client/SessionHistory.tsx) | Original discussion reader, completed-turn selection, source states, and request cancellation |
| [`src/client/session-digest-remote.ts`](src/client/session-digest-remote.ts) | Strict browser Remote request/result contract |
| [`src/client/session-merge-remote.ts`](src/client/session-merge-remote.ts) | Strict browser Session Merge Remote request/result contract |
| [`src/client/graph-model.ts`](src/client/graph-model.ts) | Graph Scope resolution, Branch and Merge edges, Session Cluster ordering, Subagent Summaries, Title Filter matches, and Branch Lineages |
| [`src/client/canvas-presentation.ts`](src/client/canvas-presentation.ts) | Ordered Session Arrangement projection and final/automatic content bounds |
| [`src/client/layout.ts`](src/client/layout.ts) and [`src/client/clusters.ts`](src/client/clusters.ts) | Tree coordinates, frames, collapse, offsets, and edge paths |
| [`src/client/viewport.ts`](src/client/viewport.ts), [`src/client/preview-placement.ts`](src/client/preview-placement.ts), and [`src/client/snap.ts`](src/client/snap.ts) | Zoom, pan, resize preservation, fit, minimap/preview placement, and alignment guides |
| [`src/client/layout-store.ts`](src/client/layout-store.ts) | Per-scope Session Arrangement persistence, migration, and fail-soft storage recovery |

## Current limitations

- Research Graph is unavailable on the no-session home screen and in a fresh blank session because neither has a conversation view ring.
- The scope graph follows one Workspace or Directory Scope at a time. Research Topics span Workspaces within one Host; discussion search is a separate body-text view.
- Pan and zoom reset on tab switch or reload; node positions, cluster offsets, and collapse state persist.
- Session Digests are generated only on demand and cached in Host memory, not persisted as durable artifacts. A Host restart clears the cache.
- A Session without a logged model route needs a configured fallback route before it can be digested.
- A Branch created from a Subagent Session has no Canvas Session parent edge and appears as a Root Session.
- One Merge accepts two or three sources, and all sources must resolve in the target's working directory. Cross-Workspace Merge is not supported.
- Merge captures immutable source snapshots; later source messages do not automatically refresh an existing Merge Session.
- Touch uses pointer-event fallbacks and has no dedicated controls.

## License

[MIT](LICENSE)
