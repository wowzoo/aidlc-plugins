---
name: requirements-handoff-po
plugin: requirements-handoff
depth: Standard
keywords:
  - requirements-handoff
  - po-requirements
  - 요구사항 핸드오프
description: Requirements and screen design to hand to a delivery team, no code — ideation/inception stages (reverse engineering for existing code), a wireframe prototype and a development request
skeleton: on
runner: true
review_cap: adversarial
guard_policy: off
sensors: on
learnings: on
summary_confirmation: on
plan_approval: on
collaborators: off
---

# requirements-handoff-po scope

A product owner turns one improvement request into the package a delivery team
builds from: intent, feasibility, scope, rough mockups, an initiative brief,
requirements, user stories, refined mockups, a clickable wireframe prototype,
and a development request that gathers them. When the project folder holds
existing code, reverse engineering opens Inception. No code is written.

The core stages join this scope through the plugin's contributions
(`adds.scopes`); the prototype and development request stages name it in
their own `scopes:` lists.
Initialization always runs. Everything else is skipped.

Unknown answers are expected. A product owner does not know where data lives
or how the target system is built; record such answers as open items for the
requester or the delivery team instead of guessing.
