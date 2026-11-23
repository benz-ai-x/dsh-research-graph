# DSH 0.2.3-alpha.2 compatibility and Session Backup retirement

This adaptation moves Research Graph from DSH `0.2.3-alpha.1` to `0.2.3-alpha.2`. The plugin version, exact `@deepseek-ai/dsh-llm` peer, and every direct `@deepseek-ai/dsh-*` dependency become `0.2.3-alpha.2`. It also removes the plugin-owned Session Backup/Restore capability and its implementation.

## Scope and method

- Old upstream: `dsh-v0.2.3-alpha.1`, commit `d98f5d68519215da48f3002da2cb9c9d2068d81d`.
- New upstream: `dsh-v0.2.3-alpha.2`, commit `4b399c39a6d1479cd84ca591b4d7c88e24d38a96`.
- The reviewed surface follows the plugin manifest, actual source/type/test imports, Client injection and build externals, profile fixtures, vendored sources, and the official upgrade guide.
- The target has no source diff in `ui-sidebar/src`, `ui-workspace/src`, or the vendored `default-workspace.ts`. Consumed DSH Session, Workspace, LLM, Typert, Storage, and Client contracts have no source changes in this range beyond unrelated Host internals.

## Retirement boundary

- Remove the sidebar **Download Session backup** action, Workspace-aware archive naming, **Restore Session backup** dialog, owner-only upload route, Remote descriptors, archive validation, attachment remapping, conflict handling, cold Session writer, configuration limits, locales, styles, dedicated tests, and backup-specific packed-profile stages.
- Native Session Header **Download Session log** and `/export` remain Host capabilities; Research Graph no longer adds its own export or restore UI.
- Preserve Workspace Folders, same-directory Workspace membership restoration, the New Session HOC used by other plugins, Research Export, research records, historical Branch recovery, Merge provenance, and offline Merge recovery.
- Existing Session logs, attachments, Host research records, and browser working positions are not migrated or deleted. The plugin no longer restores native Session ZIP archives; the former behavior remains documented by retired ADR 0021 and its historical acceptance record.

## Contract matrix

| Surface | Status | Disposition |
| --- | --- | --- |
| Node.js | **Breaking floor adapted** | DSH now requires `^24.22.3 \|\| >=26.13.1`, covering the upstream Undici security fixes. The plugin declares the same range; earlier Node 24 and 26 releases are no longer supported. |
| Cordis and Schemastery | **Updated with the Host** | Published LLM/Typert peers require Cordis `~4.2.0-alpha.1`; Schemastery moves to `~3.20.0-alpha.1`. Zod remains `4.6.6`; the plugin pnpm toolchain remains `11.7.0`. |
| Direct DSH dependencies and LLM peer | **Version-only update** | All direct DSH packages and the canonical LLM peer are pinned to `0.2.3-alpha.2`. No new DSH package is required. |
| Vendored sidebar/workspace | **Unchanged upstream source** | No re-vendor or compatibility port is needed. Only the local backup/restore deltas are removed; `VENDORED.md` records the retained local behavior. |
| `fflate` and `dsh-session-log-export` | **Removed from the plugin** | No production or fixture consumer remains. Their removal also retires the importer-only bundled `fflate` notice. The offline history recovery still uses `dsh-session-format-catalog`. |
| Session/research persistence | **No schema change** | Session data remains V4 and all plugin storage domains retain their identities. No data migration is introduced. |

## Dependency release-age handling

The latest direct target artifact observed during adaptation was `@deepseek-ai/dsh-client-ui-slots@0.2.3-alpha.2`, published `2026-11-22T09:57:39.532Z`. Local pnpm commands and CI/Publish temporarily use `pnpm_config_minimum_release_age=0`; the workflow override must be removed after **2026-11-23T09:57Z**, followed by an unmodified frozen-install check. No new `minimumReleaseAgeExclude` entries were added.

## Validation

- Dependency installation and Host/Client/recovery builds passed under the official Node.js `26.13.1` binary. The matching Harness native, Host/Client declaration, and Web outputs were rebuilt at `dsh-v0.2.3-alpha.2` before validation.
- `pnpm run check`: **32 files / 278 standalone tests passed**, including release policy, strict types, Client bundle registration, and Host/Client/recovery builds.
- `DSH_HARNESS_ROOT=/path/to/deepseek-harness pnpm check:harness`: all four compiler faces and **29 files / 391 tests passed**, including 193 real-view tests. Workspace membership recovery, Workspace Folders, historical Branch recovery, offline Merge recovery, research persistence, and real Gateway reads remain covered.
- Candidate archive: `.artifacts/benz-ai-x-dsh-research-graph-0.2.3-alpha.2.tgz`, **758887 bytes**, SHA-256 **`50f719bd5e718be80d6272e5d1a5d9a4924db5d60792b1b48bbeec2d69566af5`**, Build ID **`local-2bbf59fd`**. This is a local candidate, not an official npm artifact. Direct inspection of its manifest and built Host/Client bytes found no backup service, upload route, Remote, restore/sidebar action, or bundled `fflate`.
- The packed profile completed **19 deterministic fixture model calls**, historical Branch continuation, durable topics/sidebar/Merge/knowledge, reviewed extraction/synthesis, accepted reuse, frozen Markdown, read-only title/Digest/History/Search, restart persistence, and clean install/removal. The removed second-profile backup restoration stage is no longer part of acceptance.
- In the isolated real browser, New Session had no Research Graph restore action; a Session row menu contained exactly Pin, Rename, Fork, Archive, and Copy Session ID, with no Download Session backup row. The native Session Header still offered Download Session log and produced a valid **20076-byte** ZIP containing `session.v4.jsonl`; `unzip -t` passed. The browser tab, downloaded test artifact, and preview process were closed or removed afterward.

## Acceptance boundary

This record does not claim npm publication, deployment, real-provider model quality, or continued plugin-owned native ZIP restoration. README installation commands continue to identify the latest published plugin until a separate release is requested.
