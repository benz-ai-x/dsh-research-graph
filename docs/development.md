# Development and release

[Project overview](../README.md) · [简体中文](development.zh.md) · [User guide](user-guide.md)

Run the following commands from the repository root.

## Develop and contribute

Requirements are Node.js `^22.19.0 || >=24.0.0` and pnpm `11.7.0`.

Start with [AGENTS.md](../AGENTS.md) for contributor rules, [CONTEXT.md](../CONTEXT.md) for domain vocabulary, and root [HANDOFF.md](../HANDOFF.md) for current state and local worktrees. The [documentation map](agents/domain.md#documentation-map) distinguishes live status, durable decisions, and versioned acceptance; `docs/HANDOFF.md` is historical.

```sh
pnpm install --frozen-lockfile
pnpm run check
```

`pnpm run check` type-checks the standalone package, builds the Host and browser entries, and runs the package-owned test suite. To run the Host and full-interaction integration suite against a prepared DeepSeek Harness checkout:

```sh
pnpm --dir /path/to/deepseek-harness run build:native-system
pnpm --dir /path/to/deepseek-harness run build:lib
DSH_HARNESS_ROOT=/path/to/deepseek-harness pnpm check:harness
```

Read [`CONTEXT.md`](../CONTEXT.md) for the domain model and [`docs/adr/`](adr) for durable design decisions before changing Session, Merge, Digest, or persistence behavior. Keep both language versions of the relevant guide aligned when setup or behavior changes; update the README overviews when product scope or quick-start information changes. Start user-visible work from a [GitHub issue](https://github.com/benz-ai-x/dsh-research-graph/issues).

`check:harness` requires the Host version to equal the exact target pinned by `peerDependencies["@deepseek-ai/dsh-llm"]` in `package.json`. It checks four compiler faces: source Host/Client and published Host/Client declarations against that checkout's built public declarations, excluding the standalone Host adapters, then runs real Session, persistence, historical recovery, and UI integration tests. CI runs standalone checks on Node.js 22.19, 24, and 26 and selects `dsh-v<dsh-version>` using the validated DSH peer pin, independently of the plugin revision. Packed acceptance installs the archive in a scratch `web` profile, boots the real Host, verifies durable Merge and read-only Digest/History behavior, then removes the plugin. History reads also pass through the same RPC Gateway used by the browser, covering transport-supplied cancellation. Only model transport uses fixed responses.

Build an installable archive with:

```sh
pnpm pack --pack-destination .artifacts
pnpm --dir /path/to/deepseek-harness run build:web
DSH_HARNESS_ROOT=/path/to/deepseek-harness pnpm smoke:harness
```

For hands-on acceptance of the standard build, prepare the matching Harness with `build:native-system`, `build:lib`, and `build:web`, then run:

```sh
DSH_HARNESS_ROOT=/path/to/deepseek-harness pnpm preview:dsh
pnpm preview:dsh --stop
```

`DSH_HARNESS_ROOT` takes precedence. When it is unset or its checkout is missing, the launcher looks for `deepseek-harness-<target DSH version>` beside this repository, then one directory level higher. This also supports placing plugin worktrees inside a project folder while keeping Harness outside it. An existing checkout with a different version is rejected.

The launcher packs and installs the standard plugin in an isolated DSH profile at `.artifacts/workbench-dsh/profile/`, prints its local URL, and retains research data. Examples include A/B discussions, knowledge, and follow-up research. The clearly labelled model returns fixed demo responses without paid model calls. Restarting preserves examples and manual work while existing DSH profiles remain separate. The startup URL contains a local login credential; do not publish raw logs or `state.json`.

Local builds derive a stable `local-<hash>` Build ID from `package.json`, `tsdown.config.ts`, and all files under `src/`, including untracked or ignored files. Extra local files such as Finder metadata can therefore change the Build ID without changing the package version. Release automation can replace it by setting `DSH_SESSION_GRAPH_BUILD_ID` while building; compare the exact archive and recorded inputs when verifying a release.

### Release

The [Publish workflow](../.github/workflows/publish.yml) accepts a published GitHub Release or a manually supplied existing tag. It requires the tag to equal `v` plus the package version, reruns `pnpm run check`, packs the archive, and publishes those verified bytes under npm tag `latest` for stable versions or `next` for prereleases.

The package uses an [npm trusted publisher](https://docs.npmjs.com/trusted-publishers/) for organization `benz-ai-x`, repository `dsh-research-graph`, workflow `publish.yml`, environment `npm-publish`, and the `npm publish` action. The workflow authenticates with GitHub OIDC and must not receive a long-lived `NPM_TOKEN`; keep the GitHub environment as the deployment boundary. When bootstrapping a different package or scope, use a narrowly scoped, short-lived token only for the first publication, configure trusted publishing immediately, and then revoke the token.

For the first adaptation to a DSH release, set `package.json.version` to the full target DSH version. Further releases on the same DSH prerelease append one positive integer, such as `0.1.5-rc.2.1`, then `0.1.5-rc.2.2`; all direct DSH dependencies remain pinned to `0.1.5-rc.2`. The exact `@deepseek-ai/dsh-llm` peer pin is the canonical compatibility target. The plugin tag is `v<plugin-version>` and the upstream tag is `dsh-v<dsh-version>`. `check-version.mjs` rejects malformed revisions, dependency drift, and mismatched release tags; its `--dsh-version` option prints the validated target for CI. `check:harness`, packed acceptance, and the preview launcher all use this same target. Before release, pass `pnpm run check`, `check:harness`, and packed-profile acceptance, verify the Research Graph badge reads the same version, then merge and create the immutable tag and Release. Use Build IDs for unpublished local iterations; never overwrite published versions or rename historical tags.

The publishing workflow rebuilds the tag. After publication, download the official npm archive, check its manifest, version/Build ID and registry integrity, then run `DSH_HARNESS_ROOT=/path/to/deepseek-harness pnpm smoke:harness /absolute/path/official.tgz`. Attach those official bytes and checksums to the GitHub Release and download them again to compare. Record the final commit, workflow runs, archive hashes, and acceptance in the versioned review and root handoff.

The package exports two Node-facing entries and one lazy browser module. Every JavaScript entry ships a matching TypeScript declaration in the packed archive:

| Export | Purpose |
|---|---|
| `.` | Cordis Host services for research topics, knowledge, branching/reuse, Session insights, history/search, and durable Merge submission |
| `./invariant` | Runtime registration invariant |
| `./client` | Built dsh client module |
| `./cordis.patch.yml` | Profile bundle patch |

## Implementation

`GraphView` reads the Viewed Session, Workspace membership, session summaries, and pending-interaction map. Indexed pure helpers derive Session Clusters, Branch and Merge edges, Subagent Summaries, cross-cluster ordering, layout, snapping, Title Filter matches, and viewport state. A separate presentation pipeline applies node positions, collapse state, and cluster offsets, then routes edges around the final cards and visible frame titles before `GraphCanvas` renders the result. The Host registers package-owned services for topics, knowledge, reuse, historical branching, search, original history, digests, titles, and Merge capture. Merge submission revalidates Host truth, queues an explicit marker and canonical references, waits for the matching projection, then writes the Projection Cache before reporting success.

| File | Responsibility |
|---|---|
| [`src/research-topics-host.ts`](../src/research-topics-host.ts) | Host storage, serialized topic writes, lightweight source metadata, and lifecycle cancellation |
| [`src/client/ResearchTopics.tsx`](../src/client/ResearchTopics.tsx) and [`src/client/TopicGraph.tsx`](../src/client/TopicGraph.tsx) | Topic creation, selection, membership, arrangement drafts, and source inspection |
| [`src/client/GraphView.tsx`](../src/client/GraphView.tsx) | Workspace/Directory Scope resolution, graph derivation, and view header |
| [`src/client/GraphCanvas.tsx`](../src/client/GraphCanvas.tsx) | Canvas rendering, ports, inspector, controls, gestures, hover state, and minimap |
| [`src/config.ts`](../src/config.ts) | Exported Standard Schema, defaults, and normalized Host configuration |
| [`src/index.ts`](../src/index.ts) | Host service/domain registration, configuration, lifecycle, and Remote errors |
| [`src/knowledge-host.ts`](../src/knowledge-host.ts), [`src/knowledge-extraction.ts`](../src/knowledge-extraction.ts), [`src/knowledge-synthesis.ts`](../src/knowledge-synthesis.ts), and [`src/knowledge-export.ts`](../src/knowledge-export.ts) | Durable card revisions and sources, reviewed generation, frozen citations, and Markdown export |
| [`src/history-branch-host.ts`](../src/history-branch-host.ts) and [`src/research-reuse-host.ts`](../src/research-reuse-host.ts) | Recoverable historical branches and acknowledged admission of frozen research materials |
| [`src/session-digest.ts`](../src/session-digest.ts) and [`src/session-digest-harness.ts`](../src/session-digest-harness.ts) | Digest output validation, revision cache, concurrency control, and Harness route reconstruction |
| [`src/session-merge.ts`](../src/session-merge.ts), [`src/session-merge-host.ts`](../src/session-merge-host.ts), and [`src/session-merge-harness.ts`](../src/session-merge-harness.ts) | Browser workflow, Host validation, canonical reference submission, bounded capture, idempotent retry, and durability barrier |
| [`src/session-merge-projection.ts`](../src/session-merge-projection.ts) | Versioned Merge marker/reference projection and strict persisted-state validation |
| [`src/session-history-host.ts`](../src/session-history-host.ts) and [`src/session-history-codec.ts`](../src/session-history-codec.ts) | Read-only discussion paging, exact event boundaries, and shared strict wire validation |
| [`src/client/SessionHistory.tsx`](../src/client/SessionHistory.tsx) | Original discussion reader, completed-turn selection, source states, and request cancellation |
| [`src/session-title-host.ts`](../src/session-title-host.ts), [`src/session-insight-source.ts`](../src/session-insight-source.ts), [`src/session-insight-model.ts`](../src/session-insight-model.ts) | Read-only title suggestions and shared bounded discussion/model requests |
| [`src/client/session-digest-remote.ts`](../src/client/session-digest-remote.ts) | Strict browser Remote request/result contract |
| [`src/client/session-merge-remote.ts`](../src/client/session-merge-remote.ts) | Strict browser Session Merge Remote request/result contract |
| [`src/client/graph-model.ts`](../src/client/graph-model.ts) | Graph Scope resolution, direct/inherited Merge provenance, Branch edges, clusters, Subagent Summaries, title matches, and Branch Lineages |
| [`src/client/knowledge-graph.ts`](../src/client/knowledge-graph.ts) and [`src/research-relations.ts`](../src/research-relations.ts) | Knowledge/source/synthesis projection and acknowledged material-reuse relations |
| [`src/client/node-labels.ts`](../src/client/node-labels.ts), [`src/client/SubagentDetails.tsx`](../src/client/SubagentDetails.tsx), and [`src/client/index.ts`](../src/client/index.ts) | Display-only titles, distinct short identities, delegated-task inspection, and native catalog-based navigation |
| [`src/client/canvas-presentation.ts`](../src/client/canvas-presentation.ts) | Ordered Session Arrangement projection and final/automatic content bounds |
| [`src/client/dependency-layout.ts`](../src/client/dependency-layout.ts), [`src/client/layout.ts`](../src/client/layout.ts), and [`src/client/clusters.ts`](../src/client/clusters.ts) | Dependency rows over intact Branch clusters, independent-discussion packing, shared header geometry, collapse, and offsets |
| [`src/client/viewport.ts`](../src/client/viewport.ts), [`src/client/preview-placement.ts`](../src/client/preview-placement.ts), and [`src/client/snap.ts`](../src/client/snap.ts) | Zoom, pan, resize preservation, fit, minimap/preview placement, and alignment guides |
| [`src/client/edge-routing.ts`](../src/client/edge-routing.ts) | Final obstacle routing, relation terminals, arrows, labels, and complete route bounds |
| [`src/client/layout-store.ts`](../src/client/layout-store.ts) | Per-scope Session Arrangement persistence, migration, and fail-soft storage recovery |
| [`src/client/working-position.ts`](../src/client/working-position.ts) | Host/scope-isolated viewport, selection, reading, and search restoration |
| [`scripts/resolve-harness.mjs`](../scripts/resolve-harness.mjs) and [`scripts/workbench/start.mjs`](../scripts/workbench/start.mjs) | Matching Harness discovery and retained isolated demonstration profiles |
