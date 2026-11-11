---
slug: requirements-handoff-request-form
name: Development Request
plugin: requirements-handoff
number: "2.11"
phase: inception
execution: ALWAYS
condition: Always executes as the last stage of the requirements-handoff-po plan, whether or not the prototype stage ran
lead_agent: aidlc-product-agent
support_agents: []
mode: inline
produces:
  - requirements-handoff-request-form
consumes:
  - artifact: requirements
    required: true
  - artifact: intent-statement
    required: false
  - artifact: stakeholder-map
    required: false
  - artifact: feasibility-assessment
    required: false
  - artifact: constraint-register
    required: false
  - artifact: raid-log
    required: false
  - artifact: scope-document
    required: false
  - artifact: initiative-brief
    required: false
  - artifact: decision-log
    required: false
  - artifact: architecture
    required: false
  - artifact: component-inventory
    required: false
  - artifact: technology-stack
    required: false
  - artifact: api-documentation
    required: false
  - artifact: stories
    required: false
  - artifact: mockups
    required: false
  - artifact: interaction-spec
    required: false
  - artifact: requirements-handoff-prototype-notes
    required: false
requires_stage:
  - requirements-analysis
sensors: []
scopes:
  - requirements-handoff-po
ars:
  targets: [ua]
  cost: 2
inputs: the upstream ideation and inception artifacts of this intent; reverse-engineering artifacts when the project has existing code
outputs: requirements-handoff-request-form.md and the same content as development-request.md (under this stage's record dir, engine-resolved)
---

# Development Request

Gather what the earlier stages decided into one development request: the
document a product owner submits so the delivery team can judge, plan and
build the work. It does not decide anything new. It collects, cites, and
marks what is still open.

The sections follow what public request forms ask for: the summary and the
problem, features, research, privacy and project questions of an IT intake
form; the overview, current state, requirement summary and detailed
requirements of a public software request for proposal; and the requirement
types and per-requirement fields of a public requirements guide. See
"Sources" at the end of this file.

This stage asks no questions. Where an artifact is silent, write that the item
is open; do not guess.

## Steps

### Step 1: Load the artifacts

Read every consumed artifact the directive gives a path for. `requirements.md`
is required; the others are present only when their stage ran. The
reverse-engineering artifacts are present only for a project with existing
code. Do not edit any of them, and do not re-run an earlier stage.

### Step 2: Fill in the request

Write `requirements-handoff-request-form.md` in this stage's record directory,
in the workflow's conversation language, with these sections in this order.
Keep the section names below as headings, translated into the conversation
language.

1. **Request summary** — title; requesting team; requester and business
   owner; date; needed-by date and the reason for it; known budget or funding
   limits; related earlier work; outside parties who must review.
2. **Problem and goal** — the current state and how people work around it
   today; the problem statement; the goal and how success will be measured;
   who uses the result.
3. **Scope** — what is in scope and what is out of scope.
4. **Current system** — for existing code only: the systems, components and
   interfaces the change touches, from the reverse-engineering artifacts.
   For a new project, say so in one line.
5. **Requirement summary** — a table of how many requirements there are of
   each type: functional, performance, interface, data, security, quality,
   constraint, and any other type `requirements.md` uses.
6. **Requirements** — one row per requirement: ID, type, name, definition,
   detail, related requirements and stories, source. Keep the IDs that
   `requirements.md` and `stories.md` already use.
7. **Screens** — every screen ID from `mockups.md` with its purpose, and the
   path of the prototype `index.html` when the prototype stage ran.
8. **Research and options** — what feasibility found, the options considered
   and the decision, from the feasibility assessment and the decision log.
9. **Privacy and security** — personal or sensitive data the work handles, and
   who must review it. Write "not assessed" when no artifact covers it.
10. **Assumptions, dependencies and risks** — from the constraint register and
    the RAID log.
11. **Open questions** — every item still open, including the prototype notes,
    each with who should answer it: the requester or the delivery team.
12. **Attachments** — the path of each upstream artifact this request cites.

Give every filled-in value its source: the artifact and, where it has one, the
item ID. Mark each value that an artifact states as an assumption rather than
a decision.

### Step 3: Write the copy for people

Write the same content to `development-request.md` next to it. That is the
file the product owner sends; the first file is the artifact AI-DLC tracks.

### Step 4: Report and hand to the approval gate

Read both files back from disk and count from them. Tell the product owner, in
the conversation language:

- how many requirements the request lists, by type;
- how many open questions there are, and how many are for the requester and how
  many for the delivery team;
- where `development-request.md` is.

Then complete the stage through the normal stage protocol.

## Sources

The section list is this plugin's own synthesis of these public documents. No
text is copied from them.

- North Carolina Department of Information Technology, "Submitting an IT
  Procurement Intake Form" — the form's summary and detailed sections:
  https://it.nc.gov/documents/procurement/submitting-it-procurement-intake-form/open
- Ministry of Science and ICT (Korea), "공공SW사업 제안요청서 작성 예시"
  (public software RFP example, 2022) — overview, current state, requirement
  summary table, detailed requirements.
- NIPA (Korea), "공공 SW사업 제안요청서 작성을 위한 요구사항 상세화 실무가이드"
  (2021) — requirement types and the fields written for each requirement.
