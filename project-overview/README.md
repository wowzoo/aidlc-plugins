# project-overview

Keeps **one cumulative project overview per space**. An AI-DLC intent's record
describes one piece of work; nothing in core describes the project that all
intents are building. This plugin adds a stage at the end of each phase that
folds what the phase decided into one document, publishes it to the space's
knowledge documents, indexes it in DocumentKB, and writes a short digest into
the space's shared knowledge so the next intent's agents start from it.

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
| Digest (one per space) | `aidlc/spaces/<space>/knowledge/aidlc-shared/project-overview.md` |

The published copy is indexed with `engine knowledge onboard` and summarised
with `engine knowledge summarize`, space-wide (not associated with an intent).

**The digest is how later intents' agents see it.** Agents get space knowledge
only from `knowledge/aidlc-shared/` and their own agent directory — every inline
stage's `inline_context_paths` lists those files, and every delegated agent's
knowledge preflight loads them. Nothing in core hands `knowledge/documents/` or
DocumentKB to an agent; DocumentKB is found only by looking it up
(`engine knowledge list`/`show`). So each publish also writes the digest: the
same five-sentence summary, the path to the full overview, and which intent and
phase last updated it. It stays under 1 KB because every stage reads it.

## Design decisions and known limits

- **One more approval gate per phase.** In a normal workflow run only
  Initialization stages run without a gate, so every overview stage adds one —
  up to four per intent. (A `single: true` run and construction autonomy have
  their own rules.) The
  snapshot is mostly a merge of already-approved artifacts, so the review is a
  skim.
- **The plugin writes one file in each of two team-owned folders.** Core treats
  `knowledge/documents/` and `knowledge/aidlc-shared/` as the team's. No
  plugin-owned space-level location exists (the CodeKB is the only tool-owned
  one, and plugin artifacts must carry the plugin prefix), so this plugin owns
  exactly the published overview and the digest, writes them only inside a gated
  stage, and never touches any other file or the `documentkb/` catalog directly.
- **Published before approval.** A stage body ends at its gate, so the copy and
  the digest are published when the gate opens and the human reviews exactly what later intents
  will read. Nothing is written after Approve. A workflow abandoned at the gate
  leaves an unapproved update published; the header names the intent and phase
  so the audit trail can be checked.
- **History is append-only.** Decision Log and Intent History rows are never
  rewritten; current-state sections are rewritten only by the phase that owns
  them.
- **Concurrent intents** are narrowed, not excluded, by an SHA-256 check
  before publishing. If another intent published in between, the stage merges
  again on top of it. The check and the write are separate steps, not an atomic
  compare-and-write, so two intents publishing at the same moment can still
  both pass the check.
- **Code facts come from the CodeKB** when it exists. Core refreshes the CodeKB
  only at the start of a brownfield intent (RFC
  [#1055](https://github.com/awslabs/aidlc-workflows/issues/1055) proposes an
  end-of-intent refresh), so the Construction stage notes when the CodeKB
  predates this intent's code changes.
- **Section shape is checked loosely.** The `required-sections` sensor enforces
  only its generic floor (at least two distinct H2 headings), at advisory
  severity. A team can make it check that every H2 of a template is present
  (extra headings and order are not checked) by dropping the template as
  `aidlc/spaces/<space>/memory/templates/project-overview-<phase>-snapshot.md`
  — a plugin cannot ship memory today.

## Built with the engine's current plugin tools

Like the other plugins in this repository, it is authored for the engine's
current toolchain and ships no compose hook; build injects the bundled one.
Unlike them, it **adds stages**. Measured against AI-DLC 2.10.0 (`tools-dir` = the engine's `core/tools`):

```bash
bun <tools-dir>/aidlc-plugin-validate.ts project-overview
bun <tools-dir>/aidlc-plugin-build.ts   project-overview claude <out-dir>
bun <tools-dir>/aidlc-plugin-test.ts    project-overview --install <project-root> --harness claude
```

Results on 2026-09-30: validate `VALID` (errors 0, one expected
`compose-hook-absent` warning) · test `CLEAN` (11 files composed, drops 0,
graph compiled, 4 plugin stages present, idempotent second compose) · compiled
graph places the stages at 1.8, 2.10, 3.8 and 4.8 with 4, 11, 11 and 8 scopes.

2026-10-13, against AI-DLC 2.11.0, the stage and knowledge prose was corrected.
It had used `{{INVOKE}} engine …`, as core's source stages do. The packager
substitutes that placeholder when it builds a distribution, but compose does not
substitute it for plugin content. So on an installed tree the gate and knowledge
commands stayed literally `{{INVOKE}}`. They now read `aidlc engine …`, as the
installed core stages do. The only placeholder compose substitutes is
`{{HARNESS_DIR}}`. The `## Learn` sections now match 2.11.0 core: the diary path
comes from `directive.memory_path` when the `learnings` module is listed.
Re-verified on fresh 2.11.0 kiro-ide and claude trees: validate `VALID`, test
`CLEAN` (drops 0, 4 plugin stages, idempotent). After `engine plugin sync`, no
`{{INVOKE}}` remains, drops are 0 and doctor reports 0 problems.
