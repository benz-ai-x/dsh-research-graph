# Selected Session knowledge extraction acceptance

- Date: 2026-11-16 (Asia/Shanghai), including the PR review corrections
- Issue: [#96](https://github.com/benz-ai-x/dsh-research-graph/issues/96)
- PR: [#97](https://github.com/benz-ai-x/dsh-research-graph/pull/97)
- Target: DSH `0.2.2-rc.3`; package version remains `0.2.2-rc.3.3` for this unreleased feature branch.

## Implemented behavior

- Workspace/Directory Session details expose **Extract knowledge** beside the digest action, including after a digest is generated. Topic source details expose the same entry without adding a fourth native Session action.
- The shared extraction source reader starts with the newest history page and follows `hasEarlier` / `beforeSeq` until every earlier page is collected. It sorts the completed turns into exact source order and excludes unfinished turns. A real Host test covers 13 turns across the default ten-turn page boundary.
- Opening extraction restores the actual completed-turn selection in Original. Closing the dialog leaves those turns checked; a fresh range read verifies the original instead of accepting an extra Session identity field inside the source wire object.
- A confirmed zero-turn Host projection disables the action. Unknown or failed reads retain a local retryable error rather than claiming success.
- The existing extraction preview accepts an optional task of at most 2,000 characters. The Host appends it to the extraction system instruction without changing frozen material, the five-draft response limit, citations, or explicit per-card save flow. Per-entity output is a request, not a completeness or correctness guarantee.
- While generating, **Open session** and **New branch** are available inside the dialog. Both first cancel generation, so late output cannot replace a newer choice. This reuses the Host navigation APIs and does not add another branch workflow.
- Review corrections removed the unused initial-instruction context plumbing and added regression coverage for the defects found by the two-axis review.

## Automated evidence

- `pnpm run typecheck`: passed; all four Harness compiler faces passed.
- `pnpm run check`: **36 files / 302 tests passed**.
- `DSH_HARNESS_ROOT=/Users/pc2026/DSH-Space/deepseek-harness pnpm check:harness`: **28 files / 385 tests passed**, including source/published Host and Client compiler faces.
- Registered-view tests cover Workspace and Topic entry, backward pagination, exact Original checkbox restoration after closing the dialog, trailing unfinished-turn exclusion, optional instruction transport, zero-turn disable at 360px, digest-state persistence, cancellation on selection change, and Open/New branch cancellation during pending generation.
- The public Host extraction test generates three fixed per-attraction drafts, edits each conclusion, explicitly saves all three into a selected Research Topic, and verifies exact source boundaries. Before explicit Save, knowledge search remains empty.
- `pnpm pack --pack-destination .artifacts` followed by packed-profile smoke: **19 fixed-model calls**, then a second-profile native restore and continuation with **1 fixed-model call**; `reviewedExtraction=true`, `packedInstall=true`, `removed=true`. Local candidate only; not a published release or official-artifact identity claim.

## Real-browser evidence

The isolated `preview:dsh` profile used the fixed demo provider, not a real provider or a claim of itinerary/entity-recognition quality.

1. Selected `缓存策略的反例验证` rather than relying on the Viewed Session. The new action appeared beside **Generate digest**. Clicking read original history and opened extraction with the exact selected source Session and event range **4–20**, without generating first.
2. The source Session was explicitly added to `缓存设计：速度与一致性`. In the Topic graph its source details showed **Extract knowledge** and opened the same Session and **4–20** range.
3. At **390 × 844** responsive emulation, the Workspace action remained reachable beside **Generate digest**; **Add to Research Topic / Open session / New branch** remained the three footer actions. The 360px zero-turn and both-scope paths also have registered-view coverage.
4. A new fixed itinerary discussion asked for `华严寺、云冈石窟和大同古城墙`. Opening **Extract knowledge** selected the exact source range **5–21**. Closing the dialog without generating left **选择第 1 轮** checked in Original.
5. Reopening from that checked range, previewing, and entering `每个景点分别生成一张知识卡片` generated exactly three fixed drafts: `华严寺`, `云冈石窟`, `大同古城墙`. This demonstrates the per-entity control flow, not real-provider recognition quality.
6. The first title was edited to `华严寺（已审核）`. Its optional fields were expanded, `缓存设计：速度与一致性` was selected, and the card was saved explicitly. Its saved view showed the source discussion and turn **1–1**, event range **5–21**, and **移出所选主题**, proving selected-Topic membership. The other two generated cards remained unsaved.

Screenshots contain no access token, credential, or local absolute path:

- [Narrow Session Inspector with the adjacent action](../assets/research-graph/issue-96-narrow-action.png)
- [Reviewed extraction with an optional per-attraction task](../assets/research-graph/issue-96-extraction.png)
- [Selected-Topic saved card and another unsaved attraction draft](../assets/research-graph/issue-96-reviewed-itinerary.png)

No real-provider multi-attraction quality acceptance was performed. Automatic batch admission, factual verification, and a promise that every entity becomes a separate card remain out of scope. Preview and browser tabs were stopped after acceptance; the isolated retained profile was not deleted.
