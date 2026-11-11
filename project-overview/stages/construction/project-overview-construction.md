---
slug: project-overview-construction
name: Project Overview — Construction
plugin: project-overview
phase: construction
execution: CONDITIONAL
condition: Execute at the end of Construction whenever the project-overview plugin is composed and any Construction stage ran in this intent.
lead_agent: project-overview-curator-agent
support_agents: []
mode: inline
produces:
  - project-overview-construction-snapshot
consumes:
  - artifact: tech-stack-decisions
    required: false
  - artifact: functional-spec
    required: false
  - artifact: logical-components
    required: false
  - artifact: infrastructure-specification
    required: false
  - artifact: code-summary
    required: false
  - artifact: build-and-test-summary
    required: false
  - artifact: build-test-results
    required: false
  - artifact: cross-unit-traceability
    required: false
  - artifact: ci-config
    required: false
  - artifact: quality-gates
    required: false
requires_stage:
  - functional-design
  - nfr-requirements
  - nfr-design
  - infrastructure-design
  - code-generation
  - build-and-test
  - ci-pipeline
sensors:
  - required-sections
scopes:
  - bugfix
  - classic
  - enterprise
  - express
  - feature
  - infra
  - mvp
  - poc
  - refactor
  - security-patch
  - workshop
inputs: This intent's Construction artifacts (every Unit's code summary included), the space CodeKB when present, and the space's published project overview
outputs: project-overview-construction-snapshot.md (under this stage's record dir, engine-resolved), the published overview at aidlc/spaces/<active-space>/knowledge/documents/project-overview/project-overview.md, and its digest at aidlc/spaces/<active-space>/knowledge/aidlc-shared/project-overview.md
---

# Project Overview — Construction

MANDATORY: Follow stage-protocol.md for approval gates, question format, and completion messages.

This stage runs once, after every other Construction stage — after all Units
are built, after Build and Test, and after CI Pipeline when it ran. It folds
what Construction decided and proved — technology choices, the components and
infrastructure actually built, and the test and quality results — into the
space's cumulative project overview.

The method is in the curator's methodology knowledge, `overview-method.md`: the
template, which sections Construction owns, the merge rules, and the publish
procedure. Follow it exactly; this file does not restate it.

## Steps

### Step 1: Load the Current Overview

Resolve `<active-space>` as `overview-method.md` § Where it lives describes.
If the published overview exists, read it and record its SHA-256. If it does
not, start from the template. Read
`aidlc/spaces/<active-space>/intents/intents.json` for this intent's slug and
scope.

### Step 2: Read This Phase's Artifacts

Read each consumed artifact that exists in this intent's record, including
every Unit's `code-summary`. Every input is optional — a stage the scope
skipped simply has none. When the space CodeKB exists, cite it for code facts;
it was written before this intent changed the code, so note that in Open
Questions and Risks rather than presenting it as current.

### Step 3: Write the Snapshot

Write `project-overview-construction-snapshot.md`: the whole overview after
this update. Rewrite only the sections the table in `overview-method.md` gives
to **construction**, carry every other section forward unchanged, append to
Decision Log and Intent History, and end with `## Sources`.

### Step 4: Publish and Index

Follow `overview-method.md` § Publish and index, including the concurrent-intent
check before writing.

### Step 5: Completion Handoff

Hand completion to `stage-protocol.md` via
`aidlc engine orchestrate report --stage project-overview-construction --result <outcome>`.
That `report` call owns every lifecycle transition and advancement; never perform one in prose, and never narrate this bookkeeping to the user.
The protocol fixes the order: announce and summarise first, run the learnings
ritual when the directive lists it, and only then open the gate with
`--result awaiting-approval` and ask the approval question.

### Step 6: Present Completion & Request Approval

Completion emoji: :compass:
Review paths: the snapshot in this stage's engine-resolved record dir, the
published overview, and its digest (both already in place — say so).
Standard 2-option approval (Approve / Request Changes).
STOP for the human response. Report Approve with
`--result approved --user-input "<exact choice>"`; report
Request Changes with `--result rejected --user-input "Request Changes"` (the
engine records the human's own words from this chat as the feedback; when it
kept none, pass what they asked for in `--reason`), revise the snapshot,
publish and index again, then report `--result revised` before re-presenting.

## Sensors

The snapshot is a markdown artefact under this stage's record dir. The imported
`required-sections` sensor checks it has the template's H2 structure; a team
that wants the exact heading set enforced can drop the template as
`aidlc/spaces/<space>/memory/templates/project-overview-construction-snapshot.md`.

## Learn

When `directive.protocol_modules` lists `learnings`, follow
`stage-protocol-learnings.md`: keep the diary at `directive.memory_path` while
working and run the ritual before the approval gate, applying its bootstrap,
`single: true`, per-unit, and gate-revision exemptions. When the module is absent,
skip both the diary and the ritual.
