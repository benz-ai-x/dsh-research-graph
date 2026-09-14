# Repository Guidelines

## Start Here

Read root `CONTEXT.md` and relevant `docs/adr/` decisions before changing behavior, then root `HANDOFF.md` for the current release, worktrees, evidence, and unfinished work. `README.md` and `README.zh.md` describe the supported user experience. Historical entries in the handoff and `docs/HANDOFF.md` do not override its current-state section.

Research Graph is a DSH research workbench plugin. DSH owns Agent presets, agent execution, Subagent Sessions, Session history, and Workspace facts. The plugin owns research topics, knowledge revisions, retained provenance, and their presentation. Installing this package does not register a professional Agent preset or add an Agent Team launcher; those would be separate features.

## Project Structure & Module Organization

`src/index.ts` and `src/invariant.ts` are the Node-facing package entries. Host services and contracts live in `src/`, including research topics, knowledge/extraction/synthesis/export, material reuse, historical branching, and Session insights. Browser behavior lives in `src/client/`: PascalCase files contain React views and canvas components, while lowercase modules implement graph derivation, layout, snapping, viewport state, persistence, and localization. Styles use `GraphView.module.css`.

In `src/client/`, `graph-model.ts` derives Session facts and `knowledge-graph.ts` projects saved knowledge; `src/research-relations.ts` supplies research provenance. `dependency-layout.ts`, `layout.ts`, and `clusters.ts` place intact Branch clusters; `canvas-presentation.ts` applies arrangements before `edge-routing.ts` routes final geometry. `node-labels.ts` and `SubagentDetails.tsx` handle readable identities and delegated-task inspection.

Tests live in `tests/` and generally mirror the module they cover. `types/deepseek-harness.d.ts` supplies standalone Host adapters, not proof of upstream compatibility. `cordis.patch.yml` defines plugin wiring, `scripts/workbench/` supplies the isolated preview, and `.github/workflows/` contains CI and publishing automation.

Do not commit generated `lib/`, `coverage/`, archives, or `.artifacts/`. Preview profiles and acceptance evidence under `.artifacts/` may contain retained research data: preserve or archive them before cleanup. Keep credential-bearing URLs, logs, and `state.json` out of public documents; publish only inspected, sanitized evidence.

## Build, Test, and Development Commands

- `pnpm install --frozen-lockfile` installs the pnpm 11.7.0 dependency graph exactly as locked.
- `pnpm run build` bundles Node entries and the lazy browser module into `lib/` with tsdown.
- `pnpm run typecheck` runs strict TypeScript validation without emitting files.
- `pnpm test` builds first, then runs the standalone Vitest suite.
- `pnpm run check` runs type checking, building, and standalone tests; use it before every PR.
- `DSH_HARNESS_ROOT=/path/to/deepseek-harness pnpm test:harness` runs `views.client.spec.tsx` and `tests/**/*.harness.spec.{ts,tsx}` against a prepared Harness checkout.
- `DSH_HARNESS_ROOT=/path/to/deepseek-harness pnpm check:harness` checks four compiler faces (source Host/Client and published Host/Client), then runs the full Harness suite. Build this plugin first; prepare the matching checkout with `build:native-system` and `build:lib`.
- `pnpm pack --pack-destination .artifacts` creates the installable package archive.
- `DSH_HARNESS_ROOT=/path/to/deepseek-harness pnpm smoke:harness` installs, boots, exercises, and removes that archive in an isolated web profile. The Harness checkout also needs `build:web`. Append `/absolute/path/plugin.tgz` to test a particular archive, including official npm bytes.
- `pnpm preview:dsh` starts the standard plugin with fixed demo responses in a retained isolated profile; `pnpm preview:dsh --stop` stops that preview. This is a demonstration, not real-provider or Agent Team acceptance.

Use Node.js `^22.19.0 || >=24.0.0`.

The preview launcher prefers `DSH_HARNESS_ROOT`, then searches for `deepseek-harness-<target DSH version>` beside the repository and one directory level higher. A missing checkout falls through; a discovered incompatible version fails. Harness checks and smoke acceptance still require an explicit `DSH_HARNESS_ROOT`. Keep machine-specific paths in `HANDOFF.md`.

## Behavior Invariants

- DSH facts determine Session identity, parentage, activity, and original history. A scope-relative Root Session may still have a Host parent. Inherited Merge snapshots on a Branch remain inspectable but must not create duplicate direct Merge relations.
- Subagent summaries follow uninterrupted Subagent Derivations and stop at Branch boundaries. Inspecting them does not create canvas nodes or a team roster. Open native records only after refreshing the direct parent's catalog and checking its child entry and mode; ordinary Session navigation is insufficient. Missing completion facts do not mean Completed.
- Short canvas titles and duplicate-title identifiers are display choices. Preserve full native titles and immutable source boundaries; changing a displayed label must not rename a Session.
- Relayout clears manual positions and cluster offsets while preserving collapse, reading state, and viewport. Retain the last useful undo across repeated Relayout. Fit changes the viewport; Reset also clears collapse. Workspace arrangements are browser-local; Topic arrangements synchronize only after explicit Save arrangement.
- Graph selection does not change the Viewed Session or composer target. Saved knowledge, frozen material versions, and acknowledged reuse records survive presentation changes; drafts and browser working positions are distinct from Host records.

## Coding Style & Naming Conventions

Follow the existing TypeScript style: two-space indentation, single quotes, no semicolons, and trailing commas in multiline structures. Keep ESM import extensions explicit and use `import type` for type-only dependencies. Prefer strict, readonly interfaces and explicit return types on exported APIs. Name React components and their files in PascalCase, functions and variables in camelCase, constants in `UPPER_SNAKE_CASE`, and utility modules in kebab-case. No formatter or linter is configured, so match adjacent code and rely on `pnpm run typecheck`.

## Testing Guidelines

Write Vitest tests as `tests/<module>.client.spec.ts` or `.tsx`; package-level checks use `*.spec.ts`. Favor deterministic tests of pure graph/layout helpers and descriptive `describe`/`it` text. Add Harness tests for host-service or rendered-view integration. There is no enforced coverage threshold; cover new branches and regressions directly.

For canvas changes, exercise both Workspace/Directory and Topic rendering, wide and narrow containers, and the affected drag/collapse/Relayout/Undo/save/reopen paths. Compare rendered card, header, route, and arrow geometry where routing changes; screenshots alone cannot establish non-overlap. Fit after resizing when needed before pointer actions. State which scenarios passed without promising arbitrary dense graphs are crossing-free.

For documentation-only edits, check local links, commands, version references, bilingual consistency, and `git diff --check`. Do not report earlier release test results as tests rerun for the documentation edit; the PR and release checks below still apply.

## Commit & Pull Request Guidelines

Recent history uses concise Conventional Commit-style subjects such as `feat: ...` and `ci: ...`. Use an imperative `<type>: <summary>` subject and keep each commit focused. PRs should explain user-visible impact, list validation performed, link relevant issues, and include screenshots or recordings for canvas/UI changes. Update both `README.md` and `README.zh.md` when setup or behavior changes.

### Releases

In the DSH-aligned release line, the first plugin adaptation uses the full target DSH version. Subsequent releases for the same DSH prerelease append one positive integer revision: plugin `0.1.5-rc.2.1`, then `0.1.5-rc.2.2`, both target DSH `0.1.5-rc.2`. All direct `@deepseek-ai/dsh-*` dependencies remain pinned to the target DSH version. The exact `@deepseek-ai/dsh-llm` peer dependency in `package.json` is the canonical target; never infer it by stripping a numeric suffix. `scripts/release-versions.mjs` validates this policy for CI, Harness type checks, packed acceptance, and the preview launcher. The upstream tag is `dsh-v<dsh-version>`; this plugin uses `v<plugin-version>`. Historical independent `v0.1.0`–`v0.1.6` tags remain unchanged. Unpublished local iteration uses the generated Build ID.

Every GitHub Release must update the `version` field in `package.json` before tagging. The release tag must be `v<version>`, and the Graph header version badge must show the same version after `pnpm run build`. The badge reads the version from `package.json` at build time; never hard-code or maintain a second version string in source. Run `pnpm run check` before publishing the release.

Also pass `check:harness` and packed-profile acceptance against the matching DSH tag before release. Keep the standalone Host adapters out of the Harness compiler programs; they must never hide upstream API drift.

After publication, verify the official npm archive separately from the local candidate: manifest, version badge/Build ID, registry integrity, and packed-profile acceptance. Attach those official bytes and checksums to the GitHub Release and read them back. Record final commit, CI/publish runs, hashes, and known limitations in the release acceptance record and current handoff.

The Build ID fingerprints build inputs, not a release number or Git commit. Untracked or ignored files under `src/` can change it. Keep the package version authoritative and investigate differing inputs before claiming an official archive matches a local build.

Keep the offline history recovery executable self-contained so it runs before a profile's first Host boot. Update `THIRD-PARTY-NOTICES.md` when its bundled dependencies change.

## Core Documentation

Keep durable rules in this file, user-facing setup and behavior in both READMEs, domain vocabulary in `CONTEXT.md`, and design trade-offs in `docs/adr/`. The root handoff holds live status and local paths; `docs/reviews/` holds versioned validation and inspected screenshots. Test counts, release hashes, and machine-specific observations belong in those evidence records, not in the glossary. See [the documentation map](docs/agents/domain.md#documentation-map).

## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub Issues for `benz-ai-x/dsh-research-graph`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default five-role triage label vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository using root `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md`.

### Handoffs

The repository root `HANDOFF.md` is the only canonical live handoff. Update it in place and do not create alternate handoff files. `docs/HANDOFF.md` is a historical snapshot and must not override the root handoff.
