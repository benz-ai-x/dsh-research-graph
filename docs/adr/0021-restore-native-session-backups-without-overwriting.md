# ADR 0021: Restore native Session Backups without overwriting existing Sessions

- Status: Accepted
- Date: 2026-11-15
- Related: ADR 0011 (fixed Knowledge exports), ADR 0019 (vendored sidebar), ADR 0020 (Branch Origin)

## Context

A Research Export is a readable Markdown artifact from selected Knowledge Card revisions, not a restorable Session backup. DSH `0.2.2-rc.3` already exports one ZIP containing a root Session's complete committed JSONL event log, Subagent descendants, and referenced attachments. Its DeepSeek website importer accepts a different export format and cannot restore these native archives.

A restore needs to preserve the events from which the Host rebuilds model context, including system/developer messages, tool results, compaction, request context, and inherited prefixes. Writing only user/assistant text would lose that history. Minting new Session IDs would avoid collisions but require rewriting parentage and other event-carried identities, while overwriting an existing ID could destroy newer work. DSH persistence offers atomic per-Session creation but no cross-Session transaction or deletion API.

## Decision

1. **Use the native DSH ZIP as the single backup artifact.** Do not create a second conversation file and a separate context file. Each Session's conversation and context events remain together in its `session.v4.jsonl`; descendants and attachment bytes are additional entries in the same ZIP. The sidebar filename includes Workspace title, Session title, UTC time, and short Session ID, while native Header/`/export` names remain accepted on import.
2. **Validate the complete archive before Session writes.** Parse ZIP structure defensively and restore every log through `sessionFormatCatalog` with strict current-format validation. Verify inherited cuts and attachment coverage. Preserve Session IDs, parentage, origin, Agent preset, event sequence/time/content, and inherited prefixes. Missing attachments and unsupported or corrupt logs fail before any Session is created.
3. **Never overwrite.** An existing Session whose complete expected header and log match is reported as already present. A same-ID Session with different content rejects the import rather than replacing, truncating, or rolling back current work. The first preflight may defer only attachment-reference differences because a target attachment backend can normalize images; the final preflight compares the complete remapped log exactly.
4. **Restore into an explicitly chosen Workspace.** Rewrite restored headers' `cwd` to that Workspace's canonical path, cold-write the root and descendants without starting a live Agent, and attach only the root Session. A parent outside the archive may remain unavailable; an included inherited prefix still supplies the history. Restore does not navigate, append a recovery turn, or call a model.
5. **Report partial recovery honestly after validation.** Cancellation or an I/O failure stops later writes. Already completed Sessions and content-addressed attachments remain because DSH has no deletion transaction; the result names the completed IDs and must not claim full success. Identical retries can finish recovery without overwriting other records.
6. **Keep profile and plugin stores out of scope.** Credentials, model/plugin configuration, Workspace definitions and folders, Research Topics, Knowledge records, Branch Origin records, Workspace files, uncommitted runtime tokens, and KV cache are not part of this per-Session backup.

## Consequences

- One downloaded ZIP is sufficient to inspect, transfer, and later restore a Session tree on the same or another compatible Host.
- Repeating an import is safe, but importing a backup is not a rollback mechanism for a Session that has since changed. A separate “restore as a new copy” feature would need an explicit identity-remapping design and is not implied here.
- Target Workspace selection intentionally changes the restored execution directory, not the historical event content. Future requests are rebuilt by the current Host and can differ across DSH, plugin, or model versions.
- Strict current-format support avoids silently migrating an unrelated or newer archive. Newer native formats need a deliberate compatibility round.

## Alternatives considered

- **Markdown or user/assistant-only JSON.** Rejected: readable summaries cannot restore the complete model-relevant event history or attachments.
- **Always mint new identities.** Rejected for this round: safe deduplication and provenance preservation are more valuable than duplicate copies, and remapping every event-carried identity is a separate hard problem.
- **Whole-profile directory copy.** Rejected: it mixes credentials and unrelated configuration with the requested Session-level, on-demand restore workflow and has a much larger overwrite and security boundary.
