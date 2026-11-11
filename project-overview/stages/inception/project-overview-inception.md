---
slug: project-overview-inception
name: Project Overview — Inception
plugin: project-overview
phase: inception
execution: CONDITIONAL
condition: Execute at the end of Inception whenever the project-overview plugin is composed and any Inception stage ran in this intent.
lead_agent: project-overview-curator-agent
support_agents: []
mode: inline
produces:
  - project-overview-inception-snapshot
consumes:
  - artifact: requirements
    required: false
  - artifact: stories
    required: false
  - artifact: personas
    required: false
  - artifact: components
    required: false
  - artifact: decisions
    required: false
  - artifact: contract-summary
    required: false
  - artifact: unit-of-work
    required: false
  - artifact: unit-of-work-dependency
    required: false
  - artifact: bolt-plan
    required: false
  - artifact: team-allocation
    required: false
  - artifact: risk-and-sequencing-rationale
    required: false
  - artifact: team-practices
    required: false
  - artifact: business-overview
    required: false
  - artifact: architecture
    required: false
  - artifact: component-inventory
    required: false
  - artifact: api-documentation
    required: false
  - artifact: technology-stack
    required: false
requires_stage:
  - reverse-engineering
  - practices-discovery
  - requirements-analysis
  - user-stories
  - refined-mockups
  - domain-design
  - units-generation
  - contract-design
  - delivery-planning
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
inputs: This intent's Inception artifacts, the space CodeKB for an existing codebase, and the space's published project overview
outputs: project-overview-inception-snapshot.md (under this stage's record dir, engine-resolved), the published overview at aidlc/spaces/<active-space>/knowledge/documents/project-overview/project-overview.md, and its digest at aidlc/spaces/<active-space>/knowledge/aidlc-shared/project-overview.md
---

# Project Overview — Inception

MANDATORY: Follow stage-protocol.md for approval gates, question format, and completion messages.

This stage runs once, after every other Inception stage. It folds what
Inception decided — requirements, domain and components, the ADRs, contracts,
Units and the delivery plan — into the space's cumulative project overview, so
the next intent starts from the whole project instead of from one record.

The method is in the curator's methodology knowledge, `overview-method.md`: the
template, which sections Inception owns, the merge rules, and the publish
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
optional — a stage the scope skipped simply has none. For an existing codebase,
read the space CodeKB at `aidlc/spaces/<active-space>/codekb/<repo>/` and cite
it for code facts rather than restating them.

### Step 3: Write the Snapshot

Write `project-overview-inception-snapshot.md`: the whole overview after this
update. Rewrite only the sections the table in `overview-method.md` gives to
**inception**, carry every other section forward unchanged, append each ADR in
`decisions` to the Decision Log with its identifier, append to Intent History,
and end with `## Sources`.

### Step 4: Publish and Index

Follow `overview-method.md` § Publish and index, including the concurrent-intent
check before writing.

### Step 5: Completion Handoff

Hand completion to `stage-protocol.md` via
`aidlc engine orchestrate report --stage project-overview-inception --result <outcome>`.
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
`aidlc/spaces/<space>/memory/templates/project-overview-inception-snapshot.md`.

## Learn

When `directive.protocol_modules` lists `learnings`, follow
`stage-protocol-learnings.md`: keep the diary at `directive.memory_path` while
working and run the ritual before the approval gate, applying its bootstrap,
`single: true`, per-unit, and gate-revision exemptions. When the module is absent,
skip both the diary and the ritual.
