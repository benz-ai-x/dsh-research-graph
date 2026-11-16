# Extraction model catalog selectors acceptance

- Date: 2026-11-16 (Asia/Shanghai)
- Issue: [#100](https://github.com/benz-ai-x/dsh-research-graph/issues/100)
- Base: DSH `0.2.2-rc.3`; plugin development version `0.2.2-rc.3.4`, not a new release.

## Behavior

- Knowledge extraction replaces the provider and model text inputs with two linked `<select>` controls backed by the Host model catalog.
- The prepared Session route remains selected. A provider or model missing from the catalog is explicitly labeled as the current route rather than silently replaced.
- Changing provider selects an available model from that provider; changing model updates the exact route sent by the existing `extract` request.
- Loading, unavailable, or empty catalogs disable generation. There is no replacement free-text route or new model service.
- Existing source preview, optional task, cancellation, reviewed drafts, explicit save, and generation-time navigation remain unchanged.

## Validation

- `pnpm run check`: **36 files / 302 tests passed**.
- Matching DSH `0.2.2-rc.3`: **four compiler faces; 28 files / 386 tests passed**.
- Registered-view tests prove the fields are comboboxes rather than text inputs, preserve and label a missing current route, update the provider/model route sent to extraction, and disable generation when catalog loading fails.
- Shared extraction fixtures now include the catalog face; all 12 scroll/recovery tests affected by that fixture pass.
- Packed-profile smoke passed **19 fixed-model calls** plus a second-profile restore and **1 continuation**, with clean install/removal. This is a local development candidate, not an official npm-artifact claim.
- The preview fixture offers `Demo` and `Demo alternate`. Real isolated-browser acceptance opened the existing fixed itinerary Session, confirmed `research-prototype` and `Demo` in the two dropdowns, selected `Demo alternate`, and observed the generated batch header **`research-prototype / demo-alt`**. No real-provider quality claim is made.
- Screenshot: [Host-catalog provider and model dropdowns](../assets/research-graph/issue-100-model-select.png). It contains no credential or access token.

Preview and browser tabs were stopped after acceptance. No npm version or dist-tag was changed.
