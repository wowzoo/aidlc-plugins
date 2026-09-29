# project-overview

Keeps **one cumulative project overview per space**. An AI-DLC intent's record
describes one piece of work; nothing in core describes the project that all
intents are building. This plugin adds a stage at the end of each phase that
folds what the phase decided into one document, publishes it to the space's
knowledge documents, and indexes it in DocumentKB so the next intent's agents
can cite it.

## What it adds

| Stage | Runs | Scopes | Folds in |
|---|---|---|---|
| `project-overview-ideation` | last in Ideation | enterprise · feature · mvp · poc | intent, scope, stakeholders, feasibility, build-vs-buy, initiative brief |
| `project-overview-inception` | last in Inception | all 11 stock scopes | requirements, stories, components, ADRs (`decisions`), contracts, Units, delivery plan; CodeKB for an existing codebase |
| `project-overview-construction` | last in Construction | all 11 stock scopes | technology decisions, functional spec, logical components, infrastructure, every Unit's code summary, build-and-test and CI results |
| `project-overview-operation` | last in Operation | bugfix · enterprise · express · feature · infra · refactor · security-patch · workshop | deployment strategy, environments, SLOs, runbooks, incident plan, performance and cost results |

"Last in the phase" is the engine's doing, not a list of stage names: a plugin
stage is numbered after the highest core stage of its phase, and each scope runs
its executed stages in number order, so the stage lands at the phase end in
every scope. The scope lists are exactly the scopes that run that phase.

Also shipped:

- `agents/project-overview-curator-agent.md` — the lead persona (inline).
- `knowledge/project-overview-curator-agent/overview-method.md` — the single
  source for the template, which sections each phase owns, the merge rules and
  the publish procedure. The four stages point at it rather than restating it.

## Where the overview lives

| Copy | Path |
|---|---|
| Snapshot (per phase, per intent) | `project-overview-<phase>-snapshot.md` in the stage's record dir |
| Published (one per space) | `aidlc/spaces/<space>/knowledge/documents/project-overview/project-overview.md` |

The published copy is indexed with `engine knowledge onboard` and summarised
with `engine knowledge summarize`, space-wide (not associated with an intent).

## Design decisions and known limits

- **One more approval gate per phase.** Only Initialization stages run without
  a gate, so every overview stage adds one — up to four per intent. The
  snapshot is mostly a merge of already-approved artifacts, so the review is a
  skim.
- **The plugin writes one file in a team-owned folder.** Core treats
  `knowledge/documents/` as the team's and never writes there. No plugin-owned
  space-level location exists (the CodeKB is the only tool-owned one, and plugin
  artifacts must carry the plugin prefix), so this plugin owns exactly one file
  there, writes it only inside a gated stage, and never touches any other file
  or the `documentkb/` catalog directly.
- **Published before approval.** A stage body ends at its gate, so the copy is
  published when the gate opens and the human reviews exactly what later intents
  will read. Nothing is written after Approve. A workflow abandoned at the gate
  leaves an unapproved update published; the header names the intent and phase
  so the audit trail can be checked.
- **History is append-only.** Decision Log and Intent History rows are never
  rewritten; current-state sections are rewritten only by the phase that owns
  them.
- **Concurrent intents** are handled by an SHA-256 check before publishing: if
  another intent published in between, the stage merges again on top of it.
- **Code facts come from the CodeKB** when it exists. Core refreshes the CodeKB
  only at the start of a brownfield intent (RFC
  [#1055](https://github.com/awslabs/aidlc-workflows/issues/1055) proposes an
  end-of-intent refresh), so the Construction stage notes when the CodeKB
  predates this intent's code changes.
- **Section shape is checked loosely.** The `required-sections` sensor enforces
  only its generic H2 floor. A team can enforce the exact heading set by dropping
  the template as `aidlc/spaces/<space>/memory/templates/project-overview-<phase>-snapshot.md`
  — a plugin cannot ship memory today.

## Built with the engine's current plugin tools

Unlike the other plugins in this repository — overlay-only, with a pinned
older `hooks/compose.ts` — this one **adds stages**, so it is authored for the
engine's current toolchain and ships no compose hook; build injects the bundled
one. Measured against AI-DLC 2.10.0 (`tools-dir` = the engine's `core/tools`):

```bash
bun <tools-dir>/aidlc-plugin-validate.ts project-overview
bun <tools-dir>/aidlc-plugin-build.ts   project-overview claude <out-dir>
bun <tools-dir>/aidlc-plugin-test.ts    project-overview --install <project-root> --harness claude
```

Results on 2026-09-30: validate `VALID` (errors 0, one expected
`compose-hook-absent` warning) · test `CLEAN` (11 files composed, drops 0,
graph compiled, 4 plugin stages present, idempotent second compose) · compiled
graph places the stages at 1.8, 2.10, 3.8 and 4.8 with 4, 11, 11 and 8 scopes.
