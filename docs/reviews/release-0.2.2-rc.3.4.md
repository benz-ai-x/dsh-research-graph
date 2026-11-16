# DSH Research Graph 0.2.2-rc.3.4 release acceptance

This is the fourth same-line revision for DSH `0.2.2-rc.3`. The exact `@deepseek-ai/dsh-llm` peer and every direct `@deepseek-ai/dsh-*` dependency remain pinned to DSH `0.2.2-rc.3`. No dependency, Session-format migration, or deployment change is included.

The matching Host is official `dsh-v0.2.2-rc.3`, commit `38a6a5c965aa99ab525161efb7cc5cf1fe62fced`. The Harness checkout matched that tag during validation, with native/lib/web artifacts prepared there.

## Scope

Feature [PR #97](https://github.com/benz-ai-x/dsh-research-graph/pull/97) and Issue [#96](https://github.com/benz-ai-x/dsh-research-graph/issues/96) add reviewed knowledge extraction from a Selected Session:

- Workspace/Directory details expose **Extract knowledge** beside digest generation; Topic source details reuse the same action without a fourth native Session footer action.
- History is read backwards with `beforeSeq` so Sessions beyond ten turns retain every completed Discussion Turn. The actual completed turns are selected in Original and verified through the strict source wire shape.
- An optional task of at most 2,000 characters supports requests such as one draft per attraction. Frozen sources, five-draft response limit, citation checks, edited drafts, and explicit per-card save remain authoritative; no automatic knowledge admission occurs.
- Selection changes and unmounts cancel pending history reads. Open Session/New branch during generation first cancel that generation so late output cannot replace a newer choice.
- Confirmed zero-turn projections disable the action. Empty citations remain marked for verification; valid provenance is not a factual-quality guarantee.

Feature acceptance, screenshots, review corrections, and the fixed-provider limitation are recorded in [session-extraction-action.md](session-extraction-action.md).

## Candidate validation

- `RELEASE_TAG=v0.2.2-rc.3.4 pnpm run check`: release policy, strict types, build, and **302 tests / 36 files** passed.
- `DSH_HARNESS_ROOT=/Users/pc2026/DSH-Space/deepseek-harness pnpm check:harness`: all four compiler faces and **385 tests / 28 files** passed, including real-Host 13-turn backward pagination, exact Original selection, cancellation, and three reviewed per-attraction saves with exact sources.
- The candidate archive independently passed isolated installation, offline recovery before Host boot, historical Branch continuation, reviewed extraction/synthesis, acknowledged reuse, frozen export, read-only insights, native title rename, sidebar restart persistence, and removal with **19 deterministic fixture model calls**. A second clean profile restored the native ZIP with **zero import model calls**, then continued with exactly **one call** whose request contained the backed-up history. The report identifies plugin `0.2.2-rc.3.4` and DSH `0.2.2-rc.3`.
- Real isolated-browser acceptance covered Workspace/Topic, actual Original selection, three fixed attraction drafts, edited selected-Topic save with exact sources, and a 390px narrow inspector. The release-candidate header reads **`Research Graph v0.2.2-rc.3.4 · local-3525e2e8`** in the compact More menu, matching `package.json`. Preview and browser tabs were closed. Fixed demo responses verify workflow only; real-provider entity recognition is not claimed.

Candidate archive: `.artifacts/release-0.2.2-rc.3.4/candidate/benz-ai-x-dsh-research-graph-0.2.2-rc.3.4.tgz`, **780928 bytes**, SHA-256 `1b1fd4e2f0a8e36d702c41046d5fda2f2565fd08bc188c312d12863a8be0a5fe`, SHA-1 `f264ad9974bcc6927b06d9bd2742b88262db16d7`; Build ID **`local-3525e2e8`**. These are local-candidate values, not official npm artifact values.

## Merge and publication

Release preparation and publication evidence will be appended after the corresponding immutable commits, CI runs, registry readback, independent official-package acceptance, and Release archive checks are complete. Local candidate acceptance is not an official-artifact identity claim.
