# DSH Research Graph 0.2.2-rc.3.5 release acceptance

This is the fifth same-line revision for DSH `0.2.2-rc.3`. The exact `@deepseek-ai/dsh-llm` peer and every direct `@deepseek-ai/dsh-*` dependency remain pinned to DSH `0.2.2-rc.3`. Zod remains `4.6.6`; Node.js remains `>=24.9.0`; Schemastery `~3.19.0` and the Cordis peer `~4.1.0` are unchanged. No dependency, Session-format migration, or deployment change is included.

The matching Host is official `dsh-v0.2.2-rc.3`, commit `38a6a5c965aa99ab525161efb7cc5cf1fe62fced`. The Harness checkout matched that tag during validation, with native/lib/web artifacts prepared there.

## Scope

Feature [PR #101](https://github.com/benz-ai-x/dsh-research-graph/pull/101) and Issue [#100](https://github.com/benz-ai-x/dsh-research-graph/issues/100) add Host-linked extraction model selection:

- Provider and model dropdowns read the Host catalog and update coherently. A missing current route remains visible and explicitly marked, while catalog failure disables generation rather than silently substituting another route.
- Selected routes are reflected in actual extraction requests; existing draft, source, citation, and explicit-save behavior remains unchanged. Fixed demo responses verify workflow only, not real-provider entity recognition.

Feature [PR #102](https://github.com/benz-ai-x/dsh-research-graph/pull/102) improves Knowledge Card catalog and reading:

- Independent saved/verification/type SVG badges use Host semantic colors. The catalog searches titles, questions, and conclusions, filters status and kind, and sorts by recent save or title.
- Details group source ranges under each Session with retained excerpts and collapsed technical identifiers. Continue discussion is primary, editing secondary, and export is a tertiary text button.
- Narrow containers stack filters and present details separately with a Back-to-catalog action. These are presentation changes only; cards, revisions, exact sources, and Host records are unchanged.

## Candidate validation

- `RELEASE_TAG=v0.2.2-rc.3.5 pnpm run check`: release policy, strict types, build, and **302 tests / 36 files** passed.
- `DSH_HARNESS_ROOT=/Users/pc2026/DSH-Space/deepseek-harness pnpm check:harness`: all four compiler faces and **388 tests / 29 files** passed, including model-catalog behavior and the Knowledge Library presentation regressions.
- The candidate archive independently passed isolated installation, offline recovery before Host boot, historical Branch continuation, reviewed extraction/synthesis, acknowledged reuse, frozen export, read-only insights, native title rename, sidebar restart persistence, and removal with **19 deterministic fixture model calls**. A second clean profile restored the native ZIP with **zero import model calls**, then continued with exactly **one call** whose request contained the backed-up history. The report identifies plugin `0.2.2-rc.3.5` and DSH `0.2.2-rc.3`.
- Built-in browser acceptance on the isolated preview confirmed badge **`Research Graph v0.2.2-rc.3.5 · local-26a4949a`** and the independent saved/verification/type badges. The preview was stopped afterwards; the daily profile was not changed.
- The existing model-selection and Knowledge Library feature acceptance records provide the real interaction evidence for this revision; no new release-specific provider-quality claim is added.

Candidate archive: `.artifacts/release-0.2.2-rc.3.5/candidate/benz-ai-x-dsh-research-graph-0.2.2-rc.3.5.tgz`, **788885 bytes**, SHA-256 `df0e9ada05c66c14655f1c47147d16cbb836d209167abaee7674889f5a8df058`; Build ID **`local-26a4949a`**. These are local-candidate values, not official npm artifact values.

## Merge

Feature PR #101 passed Node 24, Node 26, and Matching DSH release CI in [run 43820282010](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/43820282010) and merged as **`7260a3f62c638940f4013b37c316c2d2958ce123`**. Post-merge [main CI run 43856022521](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/43856022521) passed.

Feature PR #102 passed Node 24, Node 26, and Matching DSH release CI in [run 43855585172](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/43855585172) and merged as **`2671df7d81879672f13d454177fb2f5c465ab806`**, matching the expected merge tree after PR #101 had already entered main. Post-merge [main CI run 43995458835](https://github.com/benz-ai-x/dsh-research-graph/actions/runs/43995458835) passed. Its two-axis review initially found saved-badge and export-hierarchy gaps; those were corrected and rechecked with no remaining findings.

## Release boundary

The candidate gates establish local release readiness. Real-provider model quality and entity recognition, true multi-device concurrency, arbitrary dense graph routing, and large-scale performance are outside this fixed-fixture acceptance. No deployment is included in this release workflow.
