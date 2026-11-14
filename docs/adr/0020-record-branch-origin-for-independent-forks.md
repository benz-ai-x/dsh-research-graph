# ADR 0020: Record Branch Origin for ordinary forks the Host no longer parents

- Status: Accepted
- Date: 2026-11-14
- Related: ADR 0003 (Merge projections), ADR 0014 (historical branch identity), ADR 0019 (vendored sidebar)

## Context

DSH `0.2.2` changed ordinary Session forks to be independent sessions. Upstream
commit `b096659245` (*fix(session): make ordinary forks independent of source
lineage*, 2026-10-23) removed `parentSession` from both ordinary-fork creation
paths (`SessionStore.fork()` in `packages/core/session/src/index.ts` and the
Session Controller fork command), and the [upgrade guide](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/upgrade-guide/v0.2.1-rc.3/independent-session-forks/guide.zh.md)
states that these forks omit `SessionHeader.parentSession` and the client
`parentSessionId`, with no replacement lineage field. Forks created through the
official sidebar, the conversation turn tail, or the Research Graph canvas
"开新分支" action therefore arrive as Canvas Sessions without a Host parent.

The graph previously derived every Branch edge from
`SessionSummary.parentId`. After the Host upgrade, those forks rendered as
unrelated Root Sessions: visually "branches without connecting lines". This was
discovered in practice on 2026-11-14: three forks of one conversation carry
`isSeeded: true` and no `parentSession`, while their inherited prefixes copy the
source conversation's delivery markers.

The Host still supplies two usable signals. When the plugin itself initiates a
fork, it knows the source and the child Session identity exactly. For any seeded
Session, the inherited prefix may also contain copied delivery markers
(`session-log-deepseek/delivery-accepted`) whose `data.sessionId` names the
source Session; the V4 reader allows foreign Session IDs only inside an
inherited prefix. The latest foreign marker after the last inherited seed
boundary names the current generation; a later boundary without its own marker
leaves the direct parent unknown instead of promoting an ancestor.

## Decision

1. **Add a plugin-owned Branch Origin record.** A Branch Origin names the Canvas
   Session a fork copy was created from: `{ childSessionId, parentSessionId,
   source: 'recorded' | 'inferred', createdAt }`. Records live in the plugin's
   Host storage domain `session_graph_branch_links` (table `origins`, keyed by
   child Session). They are plugin provenance, not Session Lineage, not a Merge
   Relation, and are never written into Session headers, logs, or model context.
2. **Record exact origin when the plugin initiates a fork.** The canvas "开新分支"
   action forks natively, then records the returned child ID against the source
   ID. A failed record must not fail the fork; the inference fallback still
   applies later. The canvas reloads origins after the record attempt because
   the native child can enter the visible scope before the record completes.
3. **Infer lacking origin on the Host.** For a seeded child with no Host parent
   and no stored record, the Host reads the inherited prefix and takes the last
   foreign delivery ID after the last inherited seed boundary as the direct
   parent, verifies that Session exists, and caches the result as `inferred`.
   Inference is bounded, abort-aware, and tolerant of unreadable Sessions. A
   later exact record upgrades an inferred record; an inferred record never
   overwrites a different recorded one.
4. **Presentation precedence.** Host `parentId` (real Session Lineage) wins over
   a recorded Branch Origin, which wins over an inferred one. A Branch Origin
   only yields a Branch relation when the named parent is visible in the same
   graph scope under the existing Canvas Session rules; otherwise the child stays
   a Root Session. The edge keeps the existing `branch` kind, so clusters,
   layout, branch lineage, and hover behavior are unchanged.
5. **Graph derivation stays authoritative for Host facts.** The fallback is
   applied only where `parentId` is absent; graph derivation remains a pure
   projection and the Branch Origin store is read separately. Graph entry points
   read every visible member in sequential batches of at most 120 IDs.

## Consequences

- Canvas forks keep visible Branch relations after the DSH change, and existing
  independent forks appear connected on the next graph read when their
  inherited prefix can be verified.
- Forks initiated entirely outside the plugin cannot be recorded exactly; they
  rely on the inference signal. Sessions without a current-generation marker,
  including nested forks whose direct parent has none, remain Root Sessions,
  which is consistent with DSH's independent-fork contract.
- The plugin now owns one more durable provenance collection; it adds no
  migration for existing profiles and no model context.
- If a future DSH release restores ordinary-fork parentage, Host `parentId`
  takes precedence and the fallback can be retired with the store intact.
- The compatibility review must treat upstream semantic changes that keep types
  identical as in scope; the rc.3 analysis listed `dsh-session` and the Session
  Controller as "unchanged" because their API and format were unchanged, while
  this behavior changed.

## Alternatives considered

- **Write `parentSession` into the seeded header for plugin forks** (for example
  by reusing the Historical Branch `prepare` path). Rejected: it contradicts the
  Host's independent-fork design, mutates Session format semantics the plugin
  does not own, and would make plugin-created forks indistinguishable from
  Subagent Derivations for Host consumers.
- **Inference only, no records.** Rejected as the sole mechanism: sessions that
  never produced delivery markers keep no exact origin, and every graph read
  would rescan full inherited prefixes.
- **Show no Branch edges and relabel ordinary forks as independent roots.**
  Honest to the Host contract, but it removes the primary graph reading
  experience users rely on; rejected as the primary behavior while remaining the
  fallback when origin cannot be verified.
- **Fork through the Historical Branch path.** Rejected: it changes the
  one-click action's turn selection and preview semantics and still covers
  neither the official sidebar nor the turn-tail fork.
