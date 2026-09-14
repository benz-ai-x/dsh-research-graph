# Domain Docs

This is a single-context repository.

## Documentation map

| Document | Owns | Update when |
| --- | --- | --- |
| [AGENTS.md](../../AGENTS.md) | Contributor rules, implementation boundaries, validation and release workflow | The supported development workflow or invariants change |
| [README.md](../../README.md) / [README.zh.md](../../README.zh.md) | Concise product overview, capability map, key capabilities, compatibility, and quick start | Overview or essential setup changes; keep both languages aligned |
| [User guide](../user-guide.md) / [使用指南](../user-guide.zh.md) | Detailed installation, research workflows, data/model behavior, troubleshooting, and limits | Supported setup or user-visible behavior changes |
| [Development](../development.md) / [开发与发布](../development.zh.md) | Development commands, acceptance, release procedure, and source navigation | Contributor workflow or implementation structure changes |
| [CONTEXT.md](../../CONTEXT.md) | Canonical domain vocabulary and ownership boundaries | A domain term is added or its meaning changes |
| [docs/adr/](../adr/) | Durable decisions and their trade-offs | A consequential design choice needs its rationale recorded |
| Root [HANDOFF.md](../../HANDOFF.md) | Current release, local worktrees, unfinished work, and evidence locations | Work changes the state the next session needs |
| [docs/reviews/](../reviews/) | Versioned acceptance, inspected screenshots, and known limitations | A feature or release is validated |

Read the handoff's current-state sections before historical entries. `docs/HANDOFF.md` is an early snapshot, not another live handoff. Keep local absolute paths, ephemeral process state, release hashes, and test totals out of `CONTEXT.md`; do not copy private authentication URLs into public evidence.

## Before exploring

Read these files when they exist:

- `CONTEXT.md` at the repository root
- Relevant ADRs under `docs/adr/`

If they do not exist, proceed silently. Domain-modeling workflows create them lazily when terminology or architectural decisions are resolved.

## Layout

```text
/
├── CONTEXT.md
├── docs/adr/
└── src/
```

## Vocabulary

Use terms defined in `CONTEXT.md` consistently in issue titles, proposals, tests, and implementation. Avoid synonyms that the glossary explicitly rejects.

If a necessary concept is missing, reconsider whether existing terminology already covers it. Otherwise, record it as a domain-modeling gap.

Check definitions against Host contracts and current code. Distinguish DSH Agent presets and execution from this plugin's research workbench, Session Lineage from retained provenance, and browser presentation from Host-persisted research records. A newly clarified definition belongs in the glossary; the implementation that preserves it belongs in source, tests, or an ADR.

## ADR conflicts

Explicitly identify proposals that contradict an existing ADR instead of silently overriding the decision.
