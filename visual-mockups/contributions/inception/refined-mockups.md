---
target: refined-mockups
bundle: visual-mockups
adds:
  consumes:
    - artifact: mockup-visual-ref
      required: false
  produces:
    - mockup-visual-ref-refined
  required_sections:
    - "Mockup Visual Ref"
fragments:
  - anchor: after-step:4
    order: 100
  - anchor: before-step:6
    order: 110
---

## fragment: after-step:4

### Step 4b (visual-mockups): Add the refined design to the same visual surface

After the refined mockups/interaction-spec markdown is written, OFFER a visual
rendering of the refined design. Rough-mockups is NOT a prerequisite — this stage
handles both "rough produced a visual" and "rough was skipped".

First, look for a prior `mockup-visual-ref` from the rough-mockups record dir
(Ideation). Three cases:

#### Case A — a prior Figma ref exists (`type: figma`)

Reuse the SAME file — do NOT mint a new one and do NOT ask about accounts again
(the org was chosen at rough; the `file_key` already encodes it).

1. With `figma-use`, add a NEW page named with a `Refined — ` prefix (e.g.
   `Refined — <intent>`) and render the refined design there. Leave the
   `Rough — …` page intact for before/after comparison. Adding a page does not
   change the `file_key`, so the customer's link keeps working and now shows both
   rounds, each labelled by its prefix. To verify the render, keep the check
   in-context: call `get_screenshot` with `enableBase64Response: true` (or
   `node.screenshot()` inside `use_figma`) so the PNG returns inline. Do NOT take
   the tool's default URL+curl path or `download_assets` to a local file — the
   `/aidlc` sandbox grants neither `curl` nor a system temp dir (a `/tmp` write is
   refused), and this plugin persists a pointer to the live file, never a
   downloaded copy.
2. Persist `mockup-visual-ref-refined` to THIS stage's record dir (`type: figma`, same
   `file_key`/`file_url`, page name `Refined — <intent>`).

#### Case B — a prior HTML ref exists (`type: html`)

Reuse the SAME HTML file. Load the `frontend-design` skill FIRST (the HTML is the
customer's design surface), then add a `Refined` section to it (a
`<section id="refined">` or a "Refined" tab) alongside the existing `Rough` section
— do not overwrite the rough section, so both rounds are visible in one file.
Persist `mockup-visual-ref-refined` (`type: html`, same file path, now carrying both
sections).

#### Case C — no prior ref (rough skipped the visual, or rough was skipped)

Offer the same three choices as rough-mockups Step 4b — Figma / HTML / neither —
gated by availability (Figma only when the MCP server + skills are present; HTML
always; account selection via `figma-create-new-file` when Figma is chosen).
Create the chosen surface fresh (Figma: a `Refined — <intent>` page in a new
file; HTML: load the `frontend-design` skill FIRST, then a new file with a
`Refined` section) and persist `mockup-visual-ref-refined`. If the user chooses neither,
do not create the ref. When the Figma path is
chosen, verify the render in-context as in Case A: `get_screenshot` with
`enableBase64Response: true` (or `node.screenshot()` inside `use_figma`), never
the default URL+curl path or `download_assets` to a local file — the `/aidlc`
sandbox grants neither `curl` nor a system temp dir.

For every case the design is a live pointer, never synced back into markdown; the
`Refined` page/section is what code-generation targets.

## fragment: before-step:6

### Step 5b (visual-mockups): Present the visual at the gate

If `mockup-visual-ref-refined` is set, present it in the completion message BEFORE the
approval gate: for `figma`, the `file_url` (note the file now carries both a
`Rough — …` and a `Refined — …` page); for `html`, the file path (both `Rough`
and `Refined` sections). The customer reviews the refined design and edits it in
place if desired; approving the gate approves the design as it currently stands.
