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

## Merge

Feature PR #97 passed Node 24, Node 26, and Matching DSH release CI in [run 43799826707](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/43799826707) and merged as **`42e1eca30ea0d6fd7575695c9b5596d0a31930a1`**. Post-merge [main CI run 43812022648](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/43812022648) passed. Two-axis review found backward-pagination, Original-selection, and generation-navigation defects; these were corrected and covered before merge.

Release preparation [PR #98](https://github.com/benz-ai-x/dsh-research-graph/pull/98) passed CI in [run 43812537031](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/43812537031) and merged as **`a723bba1659d1981ed2ee0cf427a86bda59a62fc`**. Its merge tree is identical to accepted release head `997a0b7`. Post-merge [main CI run 43813450335](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/43813450335) passed. The annotated tag `v0.2.2-rc.3.4` points to that merge.

## Publication

The [GitHub prerelease](https://github.com/benz-ai-x/dsh-research-graph/releases/tag/v0.2.2-rc.3.4) triggered successful OIDC [Publish run 43814175804](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/43814175804). The publish log identifies `+ @benz-ai-x/dsh-research-graph@0.2.2-rc.3.4`, `next`, and transparency-log entry **`3918786239`**. After registry processing completed, independent readback reported **`next=0.2.2-rc.3.4`** and **`latest=0.2.2-rc.3.3`**. Following the user's direct-install-latest instruction, `latest` was promoted to `0.2.2-rc.3.4`; registry and current-mirror readback now report **`latest=next=0.2.2-rc.3.4`**, and `@latest` resolves to that version. Package bytes and provenance are unchanged by the tag promotion. No deployment is included.

The independently downloaded official npm archive is **779783 bytes**, SHA-256 `210927a441adfaac340a400a7169fa04d5ad686076a69b79877b3a92684eefb7`, registry SHA-1 `3ae3168eb4bbc86aa1330e638d11f339372636ef`, with integrity `sha512-WeOgvUC4mP+JIrAyAFmPxLswkhK6PlsKDPc58DqckrIyzVRLJEi06aw/hoHzMOd7pkHjH0NKhUpT08QqvuCl0Q==`. Its Build ID is **`local-3525e2e8`**, matching the accepted candidate header. The local candidate remains **780928 bytes**, SHA-256 `1b1fd4e2f0a8e36d702c41046d5fda2f2565fd08bc188c312d12863a8be0a5fe`; candidate and official archives are not interchangeable.

`npm audit signatures` against the official registry returned **`invalid: []` and `missing: []`** after an initial mirror-key lookup failure was corrected by using the official registry. The official archive independently passed the same isolated packed-profile acceptance with **19 deterministic fixture model calls**, plus **one** continuation call in a second clean profile after a zero-model-call import; `reviewedExtraction=true`, `packedInstall=true`, and `removed=true`.

The official archive and `SHA256SUMS` were uploaded to the Release. GitHub asset metadata reports the same archive SHA-256 recorded above. Repeated downloads through both `gh release download` and the public Release URL timed out at `release-assets.githubusercontent.com`, so **the final download-and-byte-comparison step is still outstanding**; it is not claimed as passed. Official npm-byte verification is complete independently of that Release-CDN limitation. Private verification evidence is retained in `.artifacts/release-0.2.2-rc.3.4/official/`.
