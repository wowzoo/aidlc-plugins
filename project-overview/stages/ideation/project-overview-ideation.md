---
slug: project-overview-ideation
name: Project Overview — Ideation
plugin: project-overview
phase: ideation
execution: CONDITIONAL
condition: Execute at the end of Ideation whenever the project-overview plugin is composed and any Ideation stage ran in this intent.
lead_agent: project-overview-curator-agent
support_agents: []
mode: inline
produces:
  - project-overview-ideation-snapshot
consumes:
  - artifact: intent-statement
    required: false
  - artifact: stakeholder-map
    required: false
  - artifact: scope-document
    required: false
  - artifact: intent-backlog
    required: false
  - artifact: feasibility-assessment
    required: false
  - artifact: constraint-register
    required: false
  - artifact: raid-log
    required: false
  - artifact: competitive-analysis
    required: false
  - artifact: build-vs-buy
    required: false
  - artifact: initiative-brief
    required: false
  - artifact: decision-log
    required: false
requires_stage:
  - intent-capture
  - market-research
  - feasibility
  - scope-definition
  - team-formation
  - rough-mockups
  - approval-handoff
sensors:
  - required-sections
scopes:
  - enterprise
  - feature
  - mvp
  - poc
inputs: This intent's Ideation artifacts and the space's published project overview
outputs: project-overview-ideation-snapshot.md (under this stage's record dir, engine-resolved) and the published overview at aidlc/spaces/<active-space>/knowledge/documents/project-overview/project-overview.md
---

# Project Overview — Ideation

MANDATORY: Follow stage-protocol.md for approval gates, question format, and completion messages.

This stage runs once, after every other Ideation stage. It folds what Ideation
decided — purpose, scope, stakeholders, feasibility, build-vs-buy — into the
space's cumulative project overview, so the next intent starts from the whole
project instead of from one record.

The method is in the curator's methodology knowledge, `overview-method.md`: the
template, which sections Ideation owns, the merge rules, and the publish
procedure. Follow it exactly; this file does not restate it.

## Steps

### Step 1: Load the Current Overview

Resolve `<active-space>` as `overview-method.md` § Where it lives describes.
If the published overview exists, read it and record its SHA-256. If it does
not, start from the template. Read
`aidlc/spaces/<active-space>/intents/intents.json` for this intent's slug and
scope.

### Step 2: Read This Phase's Artifacts

Read each consumed artifact that exists in this intent's record. Every input is
optional — a stage the scope skipped simply has none.

### Step 3: Write the Snapshot

Write `project-overview-ideation-snapshot.md`: the whole overview after this
update. Rewrite only the sections the table in `overview-method.md` gives to
**ideation**, carry every other section forward unchanged, append to Decision
Log and Intent History, and end with `## Sources`.

### Step 4: Publish and Index

Follow `overview-method.md` § Publish and index, including the concurrent-intent
check before writing.

### Step 5: Open the Approval Gate

Run `{{INVOKE}} engine orchestrate report --stage project-overview-ideation --result awaiting-approval`.

### Step 6: Present Completion & Request Approval

Completion emoji: :compass:
Review paths: the snapshot in this stage's engine-resolved record dir, and the
published overview (already in place — say so).
Standard 2-option approval (Approve / Request Changes).
STOP for the human response. Report Approve with
`--result approved --user-input "<exact choice>"`; report
Request Changes with `--result rejected --user-input "<feedback>"`, revise the
snapshot, publish and index again, then report `--result revised` before
re-presenting.

## Sensors

The snapshot is a markdown artefact under this stage's record dir. The imported
`required-sections` sensor checks it has the template's H2 structure; a team
that wants the exact heading set enforced can drop the template as
`aidlc/spaces/<space>/memory/templates/project-overview-ideation-snapshot.md`.

## Learn

While running this stage, record observations in the engine-created
`<record>/<phase>/<stage>/memory.md`. Treat it as an output-only target:
never read, probe, create, or initialize it. Follow the active harness's
diary-write discipline when inserting entries under Interpretations,
Deviations, Tradeoffs, and Open questions, each with an ISO 8601 timestamp.

Stage files are immutable framework artefacts — the ritual writes into the
harness, not into this file.
