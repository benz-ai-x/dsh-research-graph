# Selected Session knowledge extraction acceptance

- Date: 2026-11-16 (Asia/Shanghai)
- Issue: [#96](https://github.com/benz-ai-x/dsh-research-graph/issues/96)
- Target: DSH `0.2.2-rc.3`; package version remains `0.2.2-rc.3.3` for this un-released feature branch.

## Implemented behavior

- Workspace/Directory Session details expose **Extract knowledge** beside the digest action, including after a digest is generated. Topic source details expose the same entry without adding a fourth native Session action.
- The shared `useSessionExtraction` hook reads every history page for the exact Selected Session, excludes unfinished turns, cancels stale reads on selection change/unmount, and opens the existing reviewed extraction dialog. The action itself makes no model request and saves no card.
- A confirmed zero-turn Host projection disables the action. Unknown or failed reads retain a local retryable error rather than claiming success.
- The existing extraction preview accepts an optional task of at most 2,000 characters. The Host appends it to the extraction system instruction without changing the frozen material, five-draft response limit, citations, or explicit per-card save flow. Per-entity output is a request, not a completeness or correctness guarantee.

## Automated evidence

- `pnpm run typecheck`: passed; four Harness compiler faces subsequently passed.
- `pnpm run check`: **36 files / 302 tests passed**.
- `DSH_HARNESS_ROOT=/Users/pc2026/DSH-Space/deepseek-harness pnpm check:harness`: **28 files / 382 tests passed**, including source/published Host and Client compiler faces.
- Focused registered-view tests: Workspace and Topic entry, two-page completed-turn range, trailing unfinished-turn exclusion, optional instruction transport, zero-turn disable at 360px, digest-state persistence, and cancellation on selection change: **5 passed**. Host instruction transport: **1 passed**.
- `pnpm pack --pack-destination .artifacts` followed by packed-profile smoke: **19 fixed-model calls**, then a second-profile native restore and continuation with **1 fixed-model call**; `reviewedExtraction=true`, `packedInstall=true`, `removed=true`. Local candidate only; not a published release or official-artifact identity claim.

## Real-browser evidence

The isolated `preview:dsh` profile used the fixed demo provider, not a real provider or a claim of itinerary/entity-recognition quality.

1. Selected `缓存策略的反例验证` rather than relying on the Viewed Session. The new action appeared beside **Generate digest**. Clicking read original history and opened extraction with the exact selected source Session and event range **4–20**, without generating first.
2. Preview showed one complete turn, 493/20,000 characters, and no omissions. The optional task accepted `每个景点分别生成一张知识卡片`; route remained `research-prototype/demo`.
3. Explicit Generate produced a fixed draft, initially **unsaved**, with the original turn cited. The title was edited to `缓存性能与权限一致性（已审核）` and saved explicitly; the saved notice retained source availability. This fixed fixture returns one general draft, so it is not evidence of real multi-attraction generation quality.
4. The source Session was explicitly added to `缓存设计：速度与一致性`. In the Topic graph its source details showed **Extract knowledge**; clicking opened the same Session and **4–20** range.
5. At **390 × 844** responsive emulation, the Workspace action remained reachable beside **Generate digest**; **Add to Research Topic / Open session / New branch** remained the three footer actions. The 360px zero-turn and both-scope paths also have registered-view coverage.

Screenshots contain no access token, credential, or local absolute path:

- [Narrow Session Inspector with the adjacent action](../assets/research-graph/issue-96-narrow-action.png)
- [Reviewed extraction with an optional per-attraction task](../assets/research-graph/issue-96-extraction.png)

The demo browser exposed an existing generic editor problem: its Topic selector's visible position was covered by explanatory text. This acceptance therefore saved the card without Topic membership and exercised Topic separately through **Add to Research Topic**. The generic editor was not changed by this feature.

No real-provider multi-attraction quality acceptance was performed. Automatic batch admission, factual verification, and a promise that every entity becomes a separate card remain out of scope. Preview and browser tabs were stopped after acceptance; the isolated retained profile was not deleted.
