# Project Overview — method

The single source for the four `project-overview-<phase>` stages: where the
overview lives, its template, which sections each phase owns, and how an update
merges into what earlier intents wrote. The stages point here instead of
restating it, so the four cannot drift apart.

## Where it lives

| Copy | Path | Role |
|---|---|---|
| **Snapshot** | `project-overview-<phase>-snapshot.md` in the stage's engine-resolved record dir | What this phase of this intent approved. Part of the intent's record. |
| **Published** | `aidlc/spaces/<active-space>/knowledge/documents/project-overview/project-overview.md` | The one current overview for the space. Indexed in DocumentKB, where a person or an agent looking it up finds it. |
| **Digest** | `aidlc/spaces/<active-space>/knowledge/aidlc-shared/project-overview.md` | What later intents' agents see without asking: the summary and the path to the published overview. |

**Why the digest exists.** Agents receive space knowledge only from
`aidlc/spaces/<active-space>/knowledge/aidlc-shared/` and their own agent
directory: every inline stage's `inline_context_paths` lists those files, and
every delegated agent's knowledge preflight loads them. Nothing delivers
`knowledge/documents/` or DocumentKB to them. So the digest is the part that
reaches every later stage, and it stays small because every stage reads it.

Resolve `<active-space>` from `aidlc/active-space` (`default` when the file is
absent).

**Ownership.** `knowledge/documents/` and `knowledge/aidlc-shared/` belong to
the team. This plugin owns exactly one file in each — the published overview
and the digest above — and writes them only inside a stage that ends at a human
approval gate. Never create, edit, move or delete any other file under
`knowledge/documents/` or `knowledge/aidlc-shared/`. Never write under
`knowledge/documentkb/`: the catalog changes only through
`aidlc engine knowledge <verb>`.

## Template

Keep these H2 headings exactly, in this order, even when a section is still
empty (write `_Not yet recorded._`). Write the prose in the language the
workflow is being conducted in.

```markdown
# Project Overview

> Maintained by the project-overview plugin. Last update: <ISO 8601 date> ·
> intent `<intent slug>` · phase <phase>. Published when that phase's approval
> gate opened; the gate decision is in that intent's audit trail.

## Purpose and Scope
## Stakeholders and Users
## Requirements
## Domain and Components
## Contracts and Interfaces
## Technology Stack
## Delivery and Units
## Quality and Tests
## Operations
## Decision Log
## Intent History
## Open Questions and Risks
## Sources
```

## Which phase owns which section

A phase stage rewrites only the sections it owns and carries every other
section forward byte-for-byte. Every stage also appends to the two log sections
and rewrites `## Sources`.

| Section | ideation | inception | construction | operation | Kind |
|---|:-:|:-:|:-:|:-:|---|
| Purpose and Scope | ● | ● | | | current |
| Stakeholders and Users | ● | ● | | | current |
| Requirements | | ● | | | current |
| Domain and Components | | ● | ● | | current |
| Contracts and Interfaces | | ● | ● | | current |
| Technology Stack | | ● | ● | | current |
| Delivery and Units | | ● | ● | | current |
| Quality and Tests | | | ● | ● | current |
| Operations | | | | ● | current |
| Decision Log | ● | ● | ● | ● | append-only |
| Intent History | ● | ● | ● | ● | append-only |
| Open Questions and Risks | ● | ● | ● | ● | current |
| Sources | ● | ● | ● | ● | rewritten each update |

Where each owned section draws from (read only what exists in this intent's
record — every input is optional):

- **ideation** — `intent-statement`, `stakeholder-map`, `scope-document`,
  `intent-backlog`, `feasibility-assessment`, `constraint-register`, `raid-log`,
  `competitive-analysis`, `build-vs-buy`, `initiative-brief`, `decision-log`.
- **inception** — `requirements`, `stories`, `personas`, `components`,
  `decisions` (ADRs), `contract-summary`, `unit-of-work`,
  `unit-of-work-dependency`, `bolt-plan`, `team-allocation`,
  `risk-and-sequencing-rationale`, `team-practices`; for an existing codebase,
  the CodeKB's `business-overview`, `architecture`, `component-inventory`,
  `api-documentation` and `technology-stack`.
- **construction** — `tech-stack-decisions`, `functional-spec`,
  `logical-components`, `infrastructure-specification`, every Unit's
  `code-summary`, `build-and-test-summary`, `build-test-results`,
  `cross-unit-traceability`, `ci-config`, `quality-gates`.
- **operation** — `deployment-strategy`, `environment-inventory`,
  `deployment-log`, `health-check-report`, `slo-config`, `runbooks`,
  `incident-plan`, `load-test-results`, `nfr-validation-matrix`, `slo-report`,
  `cost-analysis`.

## Merge rules

1. **Start from the published overview**, not from an empty template, whenever
   it exists. Record its SHA-256 before you change anything.
2. **Current sections** describe the project as it stands after this intent.
   Rewrite an owned section so it stays true, but keep what earlier intents
   established unless this intent's artifacts change it. Mark text that this
   intent introduced or changed with `(intent <slug>)` so a reader can tell
   what moved.
3. **Append-only sections never lose a row.**
   - Decision Log: one row per decision — `date · intent · phase · decision ·
     why · source path`. Carry ADR identifiers verbatim. A reversed decision
     gets a new row that names the one it supersedes; the old row stays.
   - Intent History: one row per update — `date · intent · scope · phase ·
     what changed in this overview`.
4. **Code facts come from the CodeKB.** When
   `aidlc/spaces/<active-space>/codekb/<repo>/` exists, cite its files for
   architecture, components, APIs and the technology stack instead of
   restating them. Note in Open Questions when the CodeKB is older than this
   intent's code changes.
5. **Nothing without a source.** Every statement traces to a file read in this
   run and listed under `## Sources` as a workspace-relative path. When the
   artifacts are silent, leave the statement out or list the gap under Open
   Questions and Risks.
6. **Concurrent intents.** Before publishing, re-read the published file. If
   its SHA-256 no longer matches the one recorded in rule 1, another intent
   published in between: merge again on top of the newer file. Never publish
   over a file you did not merge from.

## Publish and index

After the snapshot is written:

1. Re-check rule 6, then write the snapshot's content to the published path
   (create the `project-overview/` folder on first publish).
2. Index it:
   `aidlc engine knowledge onboard aidlc/spaces/<active-space>/knowledge/documents/project-overview/project-overview.md`
   — expect `fresh` on first publish and `edited` afterwards. `already` means
   nothing changed; say so.
3. Take the document's `id` and `sha256` from that `onboard` output (its
   `indexed` entry for this path). `knowledge list --json` does not carry
   `sha256`; `aidlc engine knowledge show <id> --json` does, if you need it
   again.
4. Write a summary of at most five sentences to
   `.project-overview-summary.txt` in this stage's record dir, then persist it:
   `aidlc engine knowledge summarize <id> --text-file <that file> --source-revision <sha256> --tags project-overview`
5. Keep the document space-wide: do not `associate` it with an intent.
6. Write the digest to
   `aidlc/spaces/<active-space>/knowledge/aidlc-shared/project-overview.md`,
   replacing the previous one. Keep it under 1 KB and in exactly this shape:

   ```markdown
   # Project overview — <active-space> · digest

   <the same summary as step 4>

   - Full overview: `aidlc/spaces/<active-space>/knowledge/documents/project-overview/project-overview.md`.
     Read it when your work needs the project as a whole — purpose, scope,
     architecture, decisions so far. Cite it, not this digest.
   - Updated at the <phase> gate of intent `<intent slug>` on <YYYY-MM-DD>.
     That intent's audit trail says whether the gate was approved.
   ```

   When `onboard` said `already`, the overview did not change: leave the digest
   as it is if it already matches, and write it if it is missing.

The published copy and the digest are in place before the approval gate opens,
so the human reviews exactly what later intents will read. On **Approve**,
write nothing more — do not touch any of the three copies after approval. On
**Request Changes**, revise the snapshot, publish, index and write the digest
again, and re-present. A workflow abandoned at
this gate leaves an unapproved update published; the header names the intent
and phase, and that intent's audit trail shows the gate was never approved.
