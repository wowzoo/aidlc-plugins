# visual-mockups — AI-DLC plugin

Give the mockup stages a **visual surface** and carry the mockup into code. At
rough/refined-mockups the customer can render the approved wireframes into
**Figma** (a file they view and edit in the browser), into a self-contained
**HTML** preview, or **neither** — their choice. Either way the mockup reaches
UI code at code-generation.

This plugin is **additive and opt-in**: with it uncomposed, core is
byte-identical. It adds **no new stages** — only three contributions:

- `contributions/ideation/rough-mockups.md` — offer Figma / HTML / neither;
  render the rough round (Figma `Rough — <intent>` page, or HTML `Rough` section);
  persist a single `mockup-visual-ref` pointer.
- `contributions/inception/refined-mockups.md` — reuse the SAME surface and add
  the refined round (Figma `Refined — <intent>` page on the same file, or a
  `Refined` section in the same HTML file), rough preserved for before/after.
  Rough-mockups is **not** a prerequisite — handles rough-skipped runs too.
- `contributions/construction/code-generation.md` — for `kind: ui` units, feed
  the mockup markdown (`mockups`, else `wireframes`) to the developer subagent
  **always**, plus the `mockup-visual-ref` (Figma link or HTML path) as the
  fidelity source **when it exists**. Closes the mockup→code path as an engine
  contract instead of leaving it to conductor discretion (as observed in a live
  run, where mockups reached code only because the conductor chose to pass them).

## Three choices at the mockup stages — Figma, HTML, or neither

The user picks per run:

- **Figma** — offered only when the Figma MCP server + skills are present. A live
  design file, viewed and edited in the browser.
- **HTML** — always available (no external account/server). A single
  self-contained HTML file with a `Rough` section and later a `Refined` section.
- **Neither** — markdown wireframes only. The markdown mockup still reaches UI
  code-generation; only the visual surface is skipped.

## The pointer model (why there is no sync-back)

The plugin persists one artifact, `mockup-visual-ref`, holding a `type`
(`figma` | `html`) and a pointer:

- `figma`: `file_key` + `file_url` + page name. A Figma file link encodes a
  `fileKey` that does not change when the design inside is edited, so AI-DLC
  stores the link and dereferences it live — never copying the design into
  markdown, never syncing back.
- `html`: the file path. The HTML file itself is the artifact.

The mockup markdown stays the structural/behavioral spec; the visual ref is the
fidelity surface. "Reflecting the result in the mockup artifact" means persisting
a stable pointer to the current design, not snapshotting it back into markdown.

**One surface, two rounds.** rough-mockups creates the surface (and, for Figma,
picks the account); refined-mockups reuses it and adds the refined round beside
the rough one — a `Refined — <intent>` Figma page next to `Rough — <intent>`, or
a `Refined` HTML section next to `Rough`. Rough is never overwritten, so the
customer compares before/after in one place, and code-generation targets the
refined round.

## Account / organization selection (Figma path)

Figma file creation goes through the official `figma-create-new-file` skill,
whose plan-resolution runs `whoami`: a single plan is used automatically; **with
more than one plan/organization the skill asks which team or org to create the
file in.** The plugin does not hardcode a plan. This happens once at whichever
stage first creates the Figma file; later stages reuse the resulting `file_key`
and do not ask again.

## What this plugin does — and does NOT

It wires **WHERE/WHEN** a visual is offered in the AI-DLC lifecycle, **which
artifact holds the pointer** (`mockup-visual-ref`), and **that the mockup reaches
UI code**. It does **NOT** reimplement **HOW** to drive Figma — that lives in the
Figma MCP server and the Figma skills. The HTML path needs no MCP server, but it
is not tooling-free either: it loads the `frontend-design` skill first.

## Scope: Kiro

This plugin targets the **Kiro unified agent harness** — one tree serving Kiro
IDE 1.x and Kiro CLI v3. The contribution markdown itself is harness-neutral;
authoring, projection, and verification here are scoped to that tree.

## Prerequisites

The contribution seam merges `produces`/`consumes`/`required_sections` and
splices prose — it does **not** install skills or register MCP servers
(`agents`/`knowledge` projection is not wired in the engine today). So whoever
installs the plugin installs those two things alongside it.

- **HTML path**: no MCP server and no Figma account, but the `frontend-design`
  skill is required — both mockup contributions instruct the conductor to load it
  before writing the HTML preview.
- **Figma path**: the `figma` MCP server plus the Figma skills (`figma-use`,
  `figma-generate-design`, `figma-create-new-file`). A Dev/Full seat on a paid
  Figma plan is required, and the server prompts for account authorization on
  first use (Figma's own requirement, not the plugin's).

The skills and the MCP registry entries live in the installer's own asset tree
(`$ASSETS/custom-skills/`, not part of this repository) and are landed next to the
compose step — see step 3a of the apply procedure in `../README.md`. The plugin
folder does not carry them, because the packager has no channel for shipping
skills or MCP servers today. On the kiro side the `figma` entry lands **disabled**,
like every other server in that registry; enable it in
`.kiro/settings/mcp.json` when you want the Figma path.

When the Figma server is not enabled, the plugin offers HTML (or neither) instead
of failing — core behavior is preserved either way.

## Installing into a Kiro IDE project

Kiro has no AI-DLC plugin store, so install is folder-drop + an explicit composer
run (the auto `.kiro.hook` is inert today — the Kiro host does not set
`${PLUGIN_ROOT}`). From a built projection:

```sh
# 1. copy the kiro-ide projection into the project
cp -r dist/plugins/visual-mockups/kiro-ide/. <project>/

# 2. run the composer once (merges the contributions into the stage sources +
#    recompiles the graph; idempotent, survives later recompiles)
AIDLC_PLUGIN_ROOT="<project>/<plugin-root>" \
AIDLC_PROJECT_DIR="<project>" \
AIDLC_HARNESS_DIR=.kiro \
  bun "<plugin-root>/hooks/compose.ts"

# 3. verify, then open in Kiro IDE and run /aidlc
#    /aidlc --doctor should list mockup-visual-ref on rough/refined-mockups
#    and as a consume on code-generation
```

> This source tree is the **authoring form**. The packager
> (`bun scripts/package.ts`) emits a projection per harness; this plugin targets
> **`dist/plugins/visual-mockups/kiro-ide/`**. The packager is not vendored in
> this patch repo — build the projection from the fork/SSOT when plugin packaging
> is wired there.

## Status

Anchors follow the host stage's step numbering: rough-mockups and refined-mockups
target Generate Artifacts and then approval (anchors `after-step:4`,
`before-step:6`); code-generation targets Read All Unit Artifacts (anchor
`after-step:1`, and `before-step:5`). Re-verify these step numbers whenever a core
version renumbers the stages — a stale anchor is dropped-with-log, meaning the
`adds` still land while the prose splice is silently skipped. Verified by composing
all three contributions on a throwaway fixture: fragments splice cleanly (drops log
empty), and the recompiled graph carries `mockup-visual-ref` on all three stages
(rough/refined `produces`, code-generation `consumes`) plus the
`mockups`/`wireframes` consumes on code-generation. Real end-to-end use waits on
the Kiro auto-compose wiring; until then, install is the manual `bun compose.ts`
above, and live verification is an IDE run.
