# Repository Guidelines

## Start Here

Read root `CONTEXT.md` and relevant `docs/adr/` decisions before changing behavior, then root `HANDOFF.md` for the current release, worktrees, evidence, and unfinished work. When editing user-facing documentation, follow the bilingual READMEs (product overview), `docs/user-guide.md` / `docs/user-guide.zh.md` (supported usage), and `docs/development.md` / `docs/development.zh.md` (development and releases).

## Project Structure & Module Organization

`src/index.ts` and `src/invariant.ts` are the Node-facing package entries. Host services and contracts live in `src/`, including research topics, knowledge/extraction/synthesis/export, material reuse, historical branching, and Session insights. Browser behavior lives in `src/client/`: PascalCase files contain React views and canvas components, while lowercase modules implement graph derivation, layout, snapping, viewport state, persistence, and localization. Styles use `GraphView.module.css`.

In `src/client/`, `graph-model.ts` derives Session facts and `knowledge-graph.ts` projects saved knowledge; `src/research-relations.ts` supplies research provenance. `dependency-layout.ts`, `layout.ts`, and `clusters.ts` place intact Branch clusters; `canvas-presentation.ts` applies arrangements before `edge-routing.ts` routes final geometry. `node-labels.ts` and `SubagentDetails.tsx` handle readable identities and delegated-task inspection.

Tests live in `tests/` and generally mirror the module they cover. `types/deepseek-harness.d.ts` supplies standalone Host adapters, not proof of upstream compatibility. `cordis.patch.yml` defines plugin wiring, `scripts/workbench/` supplies the isolated preview, and `.github/workflows/` contains CI and publishing automation.

`.gitignore` already excludes generated `lib/`, `coverage/`, archives, and `.artifacts/`. Preview profiles and acceptance evidence under `.artifacts/` may contain retained research data: preserve or archive them before cleanup, and publish only inspected, sanitized evidence — credential-bearing URLs, logs, and `state.json` stay out of public documents.

## Build, Test, and Development Commands

`package.json` declares the script set and Node range. What the environment does not say:

- `pnpm run check` (typecheck + build + standalone Vitest suite) is the pre-PR gate.
- Harness gates need an explicit `DSH_HARNESS_ROOT=/path/to/deepseek-harness`. `pnpm check:harness` checks four compiler faces (source and published, Host and Client) against that checkout, then runs the full Harness suite; build this plugin first and prepare the checkout with `build:native-system` and `build:lib`. `pnpm smoke:harness` additionally needs `build:web`; append an archive path to test specific bytes, including official npm ones.
- `pnpm pack --pack-destination .artifacts` creates the installable archive. `pnpm preview:dsh` starts the standard plugin with fixed demo responses in a retained isolated profile (`--stop` stops it); it is a demonstration, not real-provider or Agent Team acceptance. The launcher prefers `DSH_HARNESS_ROOT`, then searches for `deepseek-harness-<target DSH version>` beside the repository and one level higher; an incompatible discovered checkout fails.

Keep machine-specific paths in `HANDOFF.md`.

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

Recent history uses concise Conventional Commit-style subjects such as `feat: ...` and `ci: ...`. Use an imperative `<type>: <summary>` subject and keep each commit focused. PRs should explain user-visible impact, list validation performed, link relevant issues, and include screenshots or recordings for canvas/UI changes. Keep both language versions of the relevant guides aligned when setup or behavior changes; update both READMEs when the overview, capabilities, compatibility, or quick start changes.

### Releases

In the DSH-aligned release line, the first plugin adaptation uses the full target DSH version. Subsequent releases for the same DSH prerelease append one positive integer revision: plugin `0.1.5-rc.2.1`, then `0.1.5-rc.2.2`, both target DSH `0.1.5-rc.2`. All direct `@deepseek-ai/dsh-*` dependencies remain pinned to the target DSH version. The exact `@deepseek-ai/dsh-llm` peer dependency in `package.json` is the canonical target; never infer it by stripping a numeric suffix. `scripts/release-versions.mjs` validates this policy for CI, Harness type checks, packed acceptance, and the preview launcher. The upstream tag is `dsh-v<dsh-version>`; this plugin uses `v<plugin-version>`. Historical independent `v0.1.0`–`v0.1.6` tags remain unchanged. Unpublished local iteration uses the generated Build ID.

Every GitHub Release must update the `version` field in `package.json` before tagging. The release tag must be `v<version>`, and the Graph header version badge must show the same version after `pnpm run build`; the badge reads the version from `package.json` at build time, so the package version stays the single source. Before release, pass `pnpm run check`, `check:harness`, and packed-profile acceptance against the matching DSH tag; after publication, verify the official npm archive independently of the local candidate. `/skill:dsh-compat-fix` encodes the full adaptation and release procedure, including official-artifact verification and evidence recording. Keep the standalone Host adapters out of the Harness compiler programs; they must never hide upstream API drift.

The Build ID fingerprints build inputs, not a release number or Git commit. Untracked or ignored files under `src/` can change it. Keep the package version authoritative and investigate differing inputs before claiming an official archive matches a local build.

Keep the offline history recovery executable self-contained so it runs before a profile's first Host boot. Update `THIRD-PARTY-NOTICES.md` when its bundled dependencies change.

## Core Documentation

Keep bilingual README frontmatter with a concrete `description` and `kind: "package-bundle"`, derived from this package's `dsh.bundle.patch`; name the project with the DSH abbreviation as an independently maintained Web plugin. The rationale follows the [upstream documentation and brand guidance](docs/research/dsh-readme-guidelines-2026-09-14.md); upstream monorepo templates and translation checks are not external-plugin installation requirements.

Keep both READMEs concise — positioning, capability map, key capabilities, essential compatibility and installation, links to detail — and put operational detail in `docs/user-guide*.md` and development, release, and source navigation in `docs/development*.md`. Document ownership otherwise follows the [documentation map](docs/agents/domain.md#documentation-map).

## Agent skills

### Issue tracker

Issues and PRDs live in GitHub Issues for `benz-ai-x/dsh-research-graph`; when creating, updating, or closing one, follow `docs/agents/issue-tracker.md`.

### Triage labels

When labeling or re-scoping an Issue, use the default five-role triage label vocabulary in `docs/agents/triage-labels.md`.

### Domain docs

When deciding where a rule, term, or decision belongs, follow `docs/agents/domain.md`; this is a single-context repository using root `CONTEXT.md` and `docs/adr/`.

### Handoffs

The repository root `HANDOFF.md` is the only canonical live handoff: update it in place, create no alternates, and treat `docs/HANDOFF.md` and historical entries as snapshots that never override current state.

### Skills

For a DSH version upgrade — adaptation, validation, and release — use `/skill:dsh-compat-fix` (`.agents/skills/dsh-compat-fix/SKILL.md`, manual-invocation only in Kimi Code).
