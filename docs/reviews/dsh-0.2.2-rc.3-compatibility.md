# DSH 0.2.2-rc.3 compatibility analysis

This adaptation moves Research Graph from DSH `0.2.2-rc.2` to `0.2.2-rc.3` while preserving research-graph behavior and existing Workspace Folders.

## Scope and method

- Old upstream: `dsh-v0.2.2-rc.2`, commit `ddac96760b6edf8fa0fe17cbdcf0b512f4c12b2c`.
- New upstream: `dsh-v0.2.2-rc.3`, commit `38a6a5c965aa99ab525161efb7cc5cf1fe62fced`.
- The range contains six commits: DeepSeek chat export/import, release restart-status work, CI bubblewrap caching, and the release itself.
- The analysis starts from `package.json`'s `dsh.client.inject`, direct dependencies and exact LLM peer, then scans `src/`, `types/`, `tests/`, `scripts/`, bundler externals, and `VENDORED.md`.
- Every consumed surface records **changed / unchanged / uncertain**. No uncertain rows remain after the compiler and runtime gates. Upstream line numbers below refer to rc.3.

## Coverage inventory

The manifest/inject/import/vendored/build surface covers: `dsh-agent`, `dsh-agent-default-model`, `dsh-agent-preset-registry`, `dsh-api-gateway`, `dsh-api-remote-access`, `dsh-api-remotes`, `dsh-api-session-controller`, `dsh-api-workspace-controller`, `dsh-attachment`, `dsh-client-connection`, `dsh-client-locale`, `dsh-client-product-analytics`, `dsh-client-shortcuts`, `dsh-client-store`, `dsh-client-test-runtime`, `dsh-client-ui-context-menu` (indirect), `dsh-client-ui-conversation`, `dsh-client-ui-dockkit` (build external), `dsh-client-ui-layout`, `dsh-client-ui-primitives`, `dsh-client-ui-renderer`, `dsh-client-ui-session`, `dsh-client-ui-sidebar`, `dsh-client-ui-slots`, `dsh-client-ui-workspace`, `dsh-error`, `dsh-goal`, `dsh-jobs`, `dsh-llm`, `dsh-package-manifest`, `dsh-schedule`, `dsh-session`, `dsh-session-format-catalog`, `dsh-session-persistence`, `dsh-session-persistence-jsonl`, `dsh-session-projection`, `dsh-session-projection-cache`, `dsh-session-query`, `dsh-session-query-sqlite`, `dsh-session-reference`, `dsh-session-stats`, `dsh-session-title`, `dsh-session-turn-outline`, `dsh-storage`, `dsh-storage-domain`, `dsh-storage-json`, `dsh-subagent`, `dsh-token-meter`, `dsh-tool-todo`, `dsh-typert-protocol`, `dsh-typert-registry`, `dsh-util-values`, `dsh-util-workspace-path`, and `dsh-workspace`. `@deepseek-ai/cordis` and `@deepseek-ai/schemastery` were also checked.

## Contract matrix

| Package / consumed surface | Status | Upstream evidence and disposition |
| --- | --- | --- |
| `dsh-llm`, `dsh-error`, `dsh-package-manifest` | **Unchanged except versions** | `packages/llm/llm/src/message.ts:110`, `:246`; `assembler.ts:38`; `error.ts:8`. Zod remains `4.6.6`; `dsh-error` remains a peer. Pin all direct dependencies to rc.3. |
| `dsh-session` and persisted generation | **Unchanged** | `packages/core/session/src/types.ts:90` remains V4. No migration or writer change. |
| `dsh-agent`, `dsh-agent-default-model` | **Unchanged for used resume path** | `packages/core/agent/src/index.ts:127` retains `resumeSessionId`/`agentOptions`; `agent-default-model/src/index.ts:67` retains `currentSelection()`. |
| `dsh-session-query`, `dsh-session-query-sqlite` | **Unchanged for used reads** | `session-query/src/index.ts:140` retains `observeSession`; `:155` retains the added `inspectSession`; `:165`, `:186`, `:232` retain search/list/title. SQLite engine remains at `session-query-sqlite/src/index.ts:203`. |
| `dsh-api-session-controller`: list, projections, snapshots | **Unchanged for used reads** | `src/client/sessions/service.ts:61` and `contract/sessions.ts:106` retain list state and `refreshProjections`; `contract/snapshot.ts:69` retains the newer history fields, which the graph does not construct. |
| Session prompt/retry and model/rename Remotes | **Unchanged for plugin workflows** | `packages/api/session-controller/src/types.ts:288` retains model selection; `src/index.ts:467` retains empty-retry admission. Research prompts remain nonempty with existing request IDs. |
| `dsh-subagent` | **Unchanged for used addresses/catalog** | `packages/subagent/subagent/src/control-types.ts:62` and `projection-types.ts:35`. Optional names remain declaration-only for this plugin. |
| `dsh-api-workspace-controller`, `dsh-workspace` | **Unchanged for used entities** | `api/workspace-controller/src/client/model.ts:32`, `src/types.ts:18`; `workspace/src/types.ts:120` retains `attachSession`. |
| `dsh-jobs`, `dsh-schedule` type augmentation | **Unchanged** | `packages/jobs/jobs/src/view.ts:21` and `packages/schedule/schedule/src/client.ts:2` remain type-only inputs to the vendored archive action. |
| `dsh-typert-protocol`, `dsh-typert-registry`, `dsh-api-gateway`, `dsh-client-connection` | **Unchanged** | `typert/protocol/src/index.ts:250`, `types.ts:130`, `:468`; `typert/registry/src/service.ts:508`; `api/gateway/src/client/index.ts:103`; `client/connection/src/peer.ts:26`. Owner Peer and Remote contribution patterns stay intact. |
| `dsh-api-remotes`, `dsh-api-remote-access` | **Unchanged for custom namespaces** | `api/remotes/src/client/index.ts:197` retains the composition path; `api/gateway/src/client/index.ts:120` retains Host facts; `api/remote-access/src/client/mount.ts:27` retains endpoint types. |
| `dsh-storage`, `dsh-storage-domain`, `dsh-storage-json` | **Unchanged** | `storage-domain/src/spec.ts:35`, `domain.ts:115`; `storage/src/index.ts:47`; `storage-json/src/index.ts:39`. |
| `dsh-session-persistence`, `dsh-session-persistence-jsonl`, `dsh-session-reference` | **Unchanged** | `session-persistence/src/index.ts:144`; `session-persistence-jsonl/src/index.ts:291`; `session-reference/src/index.ts:88`. Cold-history and namespace fixtures still work. |
| `dsh-session-format-catalog` and offline recovery | **Unchanged** | `session-format-catalog/src/historical.ts:10`, `children.ts:13`. The self-contained recovery tool keeps its existing output and validation path. |
| `dsh-session-projection`, `dsh-session-projection-cache` | **Unchanged for consumed semantics** | `session-projection/src/index.ts:124`; `session-projection-cache/src/index.ts:162` retains `cachedSnapshot` selection. |
| `dsh-session-title` | **Unchanged** | `packages/session/session-title/src/index.ts:269` retains `titleProjectionDefinition`. |
| `dsh-session-stats`, `dsh-session-turn-outline`, `dsh-token-meter`, `dsh-goal`, `dsh-tool-todo`, `dsh-agent-preset-registry` | **Unchanged for graph projections** | `session-stats/src/types.ts:24`; `session-turn-outline/src/types.ts:16`; `token-meter/src/projection.ts:15`, `:32`; `goal/src/types.ts:107`; `tool-todo/src/types.ts:23`; `agent-preset-registry/src/types.ts:51`. Existing `Partial<SessionProjectionMap>` consumption remains valid. |
| `dsh-client-store`, `dsh-client-test-runtime` | **Unchanged for used helpers** | `client/store/src/index.ts:103`, `:217`; `client-test-runtime/src/index.ts:71`. |
| `dsh-client-locale`, `dsh-client-product-analytics` | **Unchanged** | `client/locale/src/client/index.ts:558` keeps `configForms`; `product-analytics/src/events.ts:6` retains the event map. |
| `dsh-client-shortcuts`, `dsh-client-ui-layout`, `dsh-client-ui-session` | **Unchanged for consumed types** | `shortcuts/src/client/types.ts:34`; `ui-layout/src/client/service.ts:16`; `ui-session/src/client/index.ts:70`. |
| `dsh-client-ui-slots`, `dsh-client-ui-renderer` | **Unchanged for existing single/list/factory composition** | `ui-slots/src/index.ts:93`, `:531`, `:621`; `ui-renderer/src/client/registry.ts:120`. The existing hoc support carries the new sidebar layer without a framework change. |
| `dsh-client-ui-conversation`, indirect `dsh-client-ui-context-menu` | **Unchanged for used contracts** | `ui-conversation/src/client/contract/slots.ts:467`, `contract/input.ts:264`; `ConversationSession.tsx:211`. The existing factory render and header fixture remain valid. |
| `dsh-client-ui-primitives` | **Changed additively** | `ui-primitives/src/icons/artwork.ts:72` and `icons/index.tsx:309` add upload icons. Existing Menu and Markdown contracts are unchanged. No plugin adaptation beyond keeping the declarations current. |
| Vendored `dsh-client-ui-workspace`: reusable picker | **Changed; required port** | `ui-workspace/src/client/contract/slots.ts:227-240` declares `workspace.picker` and `workspace.picker.directoryFlow`; `WorkspacePicker.tsx:293` defines the Factory. Both directory-picker backends inject the third hole (`ui-directory-picker-native/src/client/index.ts:35`, `ui-directory-picker-browse/src/client/index.ts:178`), so omitting it can leave activation pending. Port the Factory, occupancy source, surface flow, and structural types. |
| Vendored `dsh-client-ui-sidebar`: New Session HOC | **Changed; required port** | `ui-sidebar/src/client/contract/slots.ts:86`, `:258`; `SidebarRoot.tsx:384`; `index.ts:104`. Declare and render `sidebar.session.action`, preserving the original button, folder behavior, and narrow-screen layout. |
| `dsh-attachment` | **Unchanged for used IDs** | `attachment/src/brand.ts:6`, `:13` retain `AttachmentId`. Plugin fixtures do not consume the changed export/archive behavior. |
| `dsh-util-values`, `dsh-util-workspace-path` | **Unchanged** | `util-values/src/index.ts:12`; `util-workspace-path/src/index.ts:42`, `:58`. |
| `@deepseek-ai/cordis`, `@deepseek-ai/schemastery` | **Unchanged** | Both vendor trees have no rc.2 → rc.3 source diff. `vendor/cordis/src/context.ts:42`, `service.ts:11`; `vendor/schemastery/src/index.ts:42-90`, `:962`. Keep `~4.1.0` and `~3.19.0`. |

## Validation

- `pnpm run check`: **30 files / 253 tests passed**.
- Matching rc.3 Harness: all four compiler faces and **25 files / 362 tests passed**, including a dedicated `workspace.picker` and New Session HOC composition case.
- Candidate archive: `.artifacts/benz-ai-x-dsh-research-graph-0.2.2-rc.3.tgz`, **734165 bytes**, SHA-256 `7fc8676c3c68ac7c107880331cf1d16f42f41a5116140ac834ca33ebaf7fa7cd`; Build ID **`local-70cd4182`**.
- Packed-profile smoke: **19 deterministic fixture model calls**, including offline recovery, research reads/writes, durable sidebar restart, and clean install/removal.
- Real-browser preview: badge **`Research Graph v0.2.2-rc.3 · local-70cd4182`**, successful Host startup without a pending third directory-flow injection, workspace-menu positioning and selection, Workspace/Topic graphs, knowledge reading, narrow-screen sidebar collapse/expand, and the Workspace Folder creation entry. Preview stopped afterwards.
- The rc.3 packages were still inside their 24-hour publication window, so local commands used `pnpm_config_minimum_release_age=0`. This is a local gate exception, not a committed CI bypass.

The README history simplification already present in the working tree is unrelated to this compatibility adaptation and was preserved unchanged.
