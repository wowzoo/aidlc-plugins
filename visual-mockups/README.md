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
  persist a single `visual-mockups-ref` pointer.
- `contributions/inception/refined-mockups.md` — reuse the SAME surface and add
  the refined round (Figma `Refined — <intent>` page on the same file, or a
  `Refined` section in the same HTML file), rough preserved for before/after.
  Rough-mockups is **not** a prerequisite — handles rough-skipped runs too.
- `contributions/construction/code-generation.md` — for `kind: ui` units, feed
  the mockup markdown (`mockups`, else `wireframes`) to the developer subagent
  **always**, plus the visual pointer (Figma link or HTML path) as the
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

The plugin persists one pointer per round: `visual-mockups-ref` at rough-mockups
and `visual-mockups-ref-refined` at refined-mockups. The two names are distinct
because an artifact may have only one producer once it is consumed. Each pointer
has two sections: `## Mockup Visual Ref` (below) and `## Rendered From`, the
markdown the visual renders (`wireframes.md` or `mockups.md`, with its record
path). Two sections because the stage's `required-sections` sensor expects at
least two `##` sections in every output.

- `type: figma`: `file_key` + `file_url` + page name. A Figma file link encodes a
  `fileKey` that does not change when the design inside is edited, so AI-DLC
  stores the link and dereferences it live — never copying the design into
  markdown, never syncing back.
- `type: html`: the file path **relative to the project root**. The HTML file
  itself is the artifact. The refined round and code-generation read the pointer
  from other directories, so a record-relative path would point at the wrong place.
- `type: none`: this round has no visual — the user chose markdown only, no
  surface was available, or creating it failed — with the reason.

🔴 **The pointer is written in every run, visual or not.** The plugin adds it to
the stage's `produces`, which makes it a required output: the stage's reviewer
refuses a review while it is missing. `type: none` also overwrites a pointer an
earlier run left, so an old design never reaches code-generation.

The mockup markdown stays the structural/behavioral spec; the visual ref is the
fidelity surface. "Reflecting the result in the mockup artifact" means persisting
a stable pointer to the current design, not snapshotting it back into markdown.

**One surface, two rounds.** rough-mockups creates the surface (and, for Figma,
picks the account). refined-mockups asks again every round and, when the rough
surface is usable, offers first to continue on it — a `Refined — <intent>` Figma
page next to `Rough — <intent>`, or a `Refined` HTML section next to `Rough`.
Rough is never overwritten, so the customer compares before/after in one place.
code-generation reads the round of the pointer it picked: the refined round, or
the rough one when refined made no visual.

## Account / organization selection (Figma path)

Figma file creation goes through the official `figma-create-new-file` skill,
whose plan-resolution runs `whoami`: a single plan is used automatically; **with
more than one plan/organization the skill asks which team or org to create the
file in.** The plugin does not hardcode a plan. This happens once at whichever
stage first creates the Figma file; later stages reuse the resulting `file_key`
and do not ask again.

## What this plugin does — and does NOT

It wires **WHERE/WHEN** a visual is offered in the AI-DLC lifecycle, **which
artifact holds the pointer** (`visual-mockups-ref`), and **that the mockup reaches
UI code**. It does **NOT** reimplement **HOW** to drive Figma — that lives in the
Figma MCP server and the Figma skills. The HTML path needs no MCP server, but it
is not tooling-free either: it loads the `frontend-design` skill first.

## Scope: Kiro (IDE and CLI) and Claude Code

The contribution markdown is harness-neutral. The builder emits a projection per
harness; the prerequisites differ only in where the MCP server is registered
(`prerequisites/INSTALL.md` Step 5b).

## Build, test, install

Built with the engine's current plugin tools (`<tools-dir>` = the engine's
`core/tools`). No compose hook is vendored; the builder injects the bundled one.

```bash
bun <tools-dir>/aidlc-plugin-validate.ts visual-mockups                 # VALID, one compose-hook-absent warning
bun <tools-dir>/aidlc-plugin-build.ts   visual-mockups <harness> <out>  # claude, kiro-ide, kiro, codex, …
bun <tools-dir>/aidlc-plugin-test.ts    visual-mockups --install <project-root> --harness <harness>
```

Install the projection the host's way (`10-authoring-a-plugin.md` §5). On Kiro,
drop the projection's `.kiro` folder into the project and run
`aidlc engine plugin sync --harness-dir .kiro --plugin-root ./.kiro/aidlc-plugins/visual-mockups`.

Anchors are step **titles**: rough- and refined-mockups bind after
`Generate Artifacts` and before `Present Completion & Request Approval`;
code-generation binds after `Read All Unit Artifacts` and before
`PART 2 — Generation` (`before-step:4`), so the mockup is in the delegation
prompt before Step 4 delegates. 0.1.0 used `before-step:5`, which lands after
the delegation.

Composed, the graph gains: `rough-mockups` produces `visual-mockups-ref`;
`refined-mockups` produces `visual-mockups-ref-refined` and consumes
`visual-mockups-ref`; `code-generation` consumes both plus `mockups` and
`wireframes`. All consumes are optional.

## Prerequisites — `prerequisites/`

A plugin cannot carry skills or MCP servers, and both mockup paths need them:

- **HTML path**: no MCP server and no Figma account, but the `frontend-design`
  skill is required — both mockup contributions instruct the conductor to load it
  before writing the HTML preview.
- **Figma path**: the `figma` MCP server plus Figma's skills (`figma-use`,
  `figma-generate-design`, `figma-create-new-file`). A Dev/Full seat on a paid
  Figma plan is required, and the server prompts for account authorization on
  first use (Figma's own requirement, not the plugin's).
- **Figma path on Kiro**: no agent-file edit. From AI-DLC 2.11.1 (upstream
  #2535) every Kiro agent sees the servers the person adds: on Kiro IDE and
  Kiro CLI v3 through `includeMcpJson: true`, on Kiro CLI V2 after one
  `aidlc config`, which writes `"@figma"` into the agent JSONs. Each call asks
  for approval. Kiro CLI v3 refuses the AI's direct write to
  `.kiro/settings/mcp.json` (`Source: kiro-scope`, Kiro CLI 3.2.0), so the
  procedure registers the server with `kiro-cli mcp add --scope workspace`.
  The Figma calls themselves have not been run inside Kiro.

`prerequisites/INSTALL.md` is a procedure for the AI to follow **after** the
plugin is composed: detect the harness, find the plugin's markers, ask which
paths to prepare, copy `frontend-design`, fetch Figma's skills from
`figma/mcp-server-guide`, add the `figma` server without touching the others
(Kiro: `kiro-cli mcp add --name figma … --scope workspace`, a `figma` key in
`.kiro/settings/mcp.json` with no `disabled`, stock entries keep theirs; Claude Code: `claude mcp add --scope local`; Codex:
`.codex/config.toml`), and report. Where Figma's own Claude Code plugin is installed, it already
provides the skills and the server, and the procedure skips them.

- `frontend-design` ships in `prerequisites/skills/` (Anthropic, Apache-2.0,
  `LICENSE.txt` included, from `anthropics/skills` at `41bbe19d1a`).
- Figma's skills are **fetched, not shipped**: Figma publishes them without a
  licence file. The procedure records the commit it fetched (checked on
  2026-10-26 against `056adaf`: all three skills present, plan selection via
  `whoami` unchanged).

Neither the builder nor compose reads `prerequisites/`.

When the Figma server is not enabled, the plugin offers HTML (or neither) instead
of failing — core behavior is preserved either way.

## Changes

- **0.2.3** (2026-11-11): INSTALL registers `figma` on Kiro with `kiro-cli mcp add --scope workspace`
  (Kiro CLI v3 refuses the AI's direct write to `.kiro/settings/mcp.json`) and drops the hand edit of
  `.kiro/agents/aidlc*`, which AI-DLC 2.11.1 made unnecessary; a tree edited by the older procedure
  is recovered by moving the edited agent files out before `aidlc config`.

## Upgrading from 0.1.0

- 0.1.0 carried the pinned compose hook and `bundle:`, and could only be composed
  by running that hook directly. 0.2.0 uses `plugin:` only and no vendored hook,
  so `aidlc engine plugin sync` installs it.
- The pointers are renamed: `mockup-visual-ref` → `visual-mockups-ref`,
  `mockup-visual-ref-refined` → `visual-mockups-ref-refined` (the validator
  requires a plugin's produced artifacts to carry its name). An intent that ran
  rough-mockups under 0.1.0 has the old file name in its record; rename it, or
  code-generation will not find it.
- 🔴 **Restore the three stage files from stock before the first sync.** 0.1.0's
  compose wrote its `produces`/`consumes` into the stage frontmatter without an
  ownership record, so sync replaces the fragments but leaves those entries, and
  the graph then carries both names. Copy `rough-mockups.md`,
  `refined-mockups.md` and `code-generation.md` back from the same AI-DLC
  release's distribution, then sync (measured on 2.11.1: no old name left,
  fragments re-applied, graph check exit 0).
- Behaviour fixes in the fragments: the pointer is written in every run
  (`type: none` without a visual), an HTML path is relative to the project root,
  the pointer carries a `## Rendered From` section, refined-mockups asks every
  round, and code-generation's second fragment moved from `before-step:5` to
  `before-step:4` so the mockup reaches the prompt before delegation.
- The prerequisites moved from an external asset tree into `prerequisites/`.
