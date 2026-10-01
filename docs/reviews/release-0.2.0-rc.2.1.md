# DSH Research Graph 0.2.0-rc.2.1 release acceptance

This is the first same-line revision of the DSH 0.2.0-rc.2 line: per the release policy the plugin version appends one revision (`0.2.0-rc.2.1`) while the DSH target and every pinned `@deepseek-ai/dsh-*` dependency stay at `0.2.0-rc.2`. The release carries the workbench design refresh against the baseline in `docs/design/` (brand spec plus prototype): readable layered node cards, one find-and-tools canvas toolbar with a click-to-locate match dropdown, chrome and edge-language alignment, a narrower default inspector, and lighter reading typography. No upstream contract changed and no adapter, fixture, or persistence change was needed; the round also folds in the overdue CI age-gate revert (the temporary `pnpm_config_minimum_release_age=0` override from the 0.2.0-rc.2 round, whose 24-hour window closed 2026-09-30 09:41 UTC — PR #52 precedent).

## Compatibility and scope

- Plugin: `@benz-ai-x/dsh-research-graph@0.2.0-rc.2.1`; tag `v0.2.0-rc.2.1`; npm dist-tag `next` (`latest` stays `0.1.5-rc.1`).
- Target: official DSH `dsh-v0.2.0-rc.2`, commit `639ed015397290b3745d163aafe02ffee4aa3f84` (unchanged from 0.2.0-rc.2; the matching checkout's native/lib/web builds from 2026-09-29 were reused, still newer than the tag commit).
- The exact LLM peer and all direct DSH dependencies remain pinned to `0.2.0-rc.2`; `@deepseek-ai/cordis` stays `^4.0.2` (the `pnpm peers check` `~4.0.4` notice predates this line).
- Base: main `d09f3a1b9ad5aedb4e1276605dfa2d6eff87d28f` (merge of [PR #58](https://github.com/benz-ai-x/dsh-research-graph/pull/58), tree verified identical to the accepted head `bed6dc5`).
- CI/publish workflows run **without** the `pnpm_config_minimum_release_age` override for the first time since the 0.1.7-rc.2 round: the local frozen install passed un-bypassed, and all four PR checks — including the Matching DSH release packed-profile smoke — passed green on the override's removal.
- No persistence schema, bundled recovery dependency, or daily user profile changes. README workbench screenshot was re-captured on this build for the design refresh.

## Validation

- Frozen pnpm **11.7.0** installation (verified **without** the age-gate bypass), Node.js **27.x** local / CI matrix 22.19·24·26.
- `RELEASE_TAG=v0.2.0-rc.2.1 pnpm run check`: version policy, strict types, build, **231 tests / 26 files** passed.
- Matching `pnpm check:harness` against `dsh-v0.2.0-rc.2`: all four compiler faces and **348 tests / 23 files** passed (the +1 file / +47 tests delta over 0.2.0-rc.2 is this round's design coverage, including the new find-dropdown view spec; geometry assertions now derive from the exported layout constants instead of hard-coded pixels).
- The candidate archive (packed locally, **504020 bytes**, SHA-256 `1bb4edb14dbe5bb6345acf64642e43cfa173be996a454c1a418ebf7b887c5093`, Build ID `local-f99a3345`) passed the isolated packed-profile acceptance — install, offline recovery before Host boot, startup, persistent research operations, historical Branch continuation, reviewed mixed synthesis, extraction/reuse, export, read-only insights, shutdown, removal — with **19 deterministic fixture model calls**, first-round green.
- Real-browser isolated preview on the official `dsh-v0.2.0-rc.2` Host (retained demo profile): the workbench badge reads **Research Graph v0.2.0-rc.2.1 · local-f99a3345**; the Workspace graph renders the new layered cards (kind line, excerpt, status-closing meta, round badges), and the cross-workspace Topic graph renders session and knowledge-card nodes with **solid source edges and dashed reuse edges (both arrow-headed)** — verified by DOM measurement that every node sits inside the canvas after Fit, with the knowledge inspector open and overlapping nothing. A transient horizontal scroll of the Host frame during viewport resizing initially looked like clipped cards; resetting the Host frame scroll restored exact in-canvas geometry, so it is a Host-frame artifact, not a plugin defect. Design-refresh screenshots are retained privately in `.artifacts/design-refresh-0.2.0-rc.2.1/`. The preview was stopped afterwards and the research data retained.
- The official npm archive verification is recorded under **Published artifact** below.

## Published artifact

Publication completed on **2026-10-01 at 01:52 UTC** (09:52 Asia/Shanghai) through the OIDC publish workflow (run [36803080249](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/36803080249)).

| Official npm artifact | Verified value |
| --- | --- |
| Archive | `benz-ai-x-dsh-research-graph-0.2.0-rc.2.1.tgz` |
| Size | 503079 bytes |
| Build ID | `local-f99a3345` |
| SHA-256 | `e54d888f256c2b0b9468f26eab8b0373927b94940febe9c5db9f7f66aa3c8d0f` |

The registry SHA-1 (`594325477376ba9437de06998ad3ead62fb5055f`) and SHA-512 integrity (`sha512-hNQQVQC+zrbACPwxOGjusnkgMnEg8jsvgg0EEkq9GyCR/yAC9a9iWz/6y7KQVHF8p/Vg7UzOyG2os3qU1OjQYw==`) match the downloaded official bytes. The SLSA provenance attestation names this repository at `refs/tags/v0.2.0-rc.2.1`, workflow `.github/workflows/publish.yml`, with the archive's SHA-512 as the subject digest (transparency-log index 3028936887; certificate signatures were not separately cryptographically verified). The official archive passed the same isolated packed-profile acceptance with **19 fixed model calls**, and its Build ID `local-f99a3345` equals the candidate's and the badge verified in the browser preview. The local candidate archive (504020 bytes, SHA-256 `1bb4edb14dbe5bb6345acf64642e43cfa173be996a454c1a418ebf7b887c5093`) differed in bytes because it was packed locally rather than by CI — both passed the same acceptance independently. The Release archive and `SHA256SUMS` were uploaded, downloaded again, and matched the official npm bytes exactly; the release body was read back. [PR #58 CI](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/36801092712), [PR #59 CI](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/36802354694), the merged main CI ([#58](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/36801850392), [#59](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/36803042817)), and the OIDC Publish all passed; npm `next` is `0.2.0-rc.2.1` and `latest` remains `0.1.5-rc.1`.

Private release evidence lives in `.artifacts/release-0.2.0-rc.2.1/`; the official archive and checksums are in `official/`.

## Acceptance boundary

Existing manual arrangements remain until **Relayout** (Undo-safe, collapse- and reading-state-preserving); **Fit** adjusts the viewport; Topic arrangements synchronize only through explicit **Save arrangement**. The cold-start observation — an unopened Branch temporarily lacking its durable title and inherited-source summary in native lists — remains unlocated at the Host layer and is not claimed as repaired; the graph itself recovers retained titles and facts through non-activating projection reads, so the phenomenon is not visible to graph users. Arbitrary dense graphs can still have crossings or obstructed terminals; this round's geometry tests cover the two scopes (Workspace/Directory and Topic) with the new 280×120 card constants, not arbitrary density. The two structured research-direction requirements in [Issue #32](https://github.com/benz-ai-x/dsh-research-graph/issues/32) remain deferred.
