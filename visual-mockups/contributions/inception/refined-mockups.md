---
target: refined-mockups
plugin: visual-mockups
adds:
  consumes:
    - artifact: visual-mockups-ref
      required: false
  produces:
    - visual-mockups-ref-refined
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

First, check what is available **this round**, as rough-mockups Step 4b does.
Figma needs the MCP server connected and the Figma skills present. HTML needs the
`frontend-design` skill. Then look for a prior `visual-mockups-ref` from the
rough-mockups record dir (Ideation).

**Ask the user every round.** Offer only what is available, and put first:

- **Continue on the same surface (recommended)** — only when the prior pointer is
  `figma` or `html` and that surface is usable now.
- **Figma** or **HTML** as a new surface — every type that is available this
  round. When "continue" is offered, leave out its own type here (continuing
  already covers it). When the prior surface is unusable or there is none, offer
  every available type, the prior one included.
- **Neither** — keep the markdown only.

Then follow the case that matches the answer:

- **Continue:** Case A (Figma) or Case B (HTML).
- **A new surface:** Case C, creating the chosen one.
- **Neither:** write the pointer as `type: none` (below).

#### Case A — continue on the prior Figma file (`type: figma`)

**Only when Figma is available this round and the file opens.** Otherwise tell the
user the prior Figma file cannot be used now and go to Case C. Reuse the SAME
file — do NOT mint a new one and do NOT ask about accounts again
(the org was chosen at rough; the `file_key` already encodes it).

1. With `figma-use`, render the refined design on the `Refined — <intent>` page.
   If an earlier run of this stage already made that page, update it in place;
   otherwise add it as a NEW page. Never add a second page of the same name. Leave the
   `Rough — …` page intact for before/after comparison. Adding a page does not
   change the `file_key`, so the customer's link keeps working and now shows both
   rounds, each labelled by its prefix. To verify the render, keep the check
   in-context: call `get_screenshot` with `enableBase64Response: true` (or
   `node.screenshot()` inside `use_figma`) so the PNG returns inline. Do NOT take
   the tool's default URL+curl path or `download_assets` to a local file. `curl`
   is not on AI-DLC's command allowlist, so it would stop for an extra approval.
   And this plugin persists a pointer to the live file, never a downloaded copy.
2. Persist `visual-mockups-ref-refined` to THIS stage's record dir (`type: figma`, same
   `file_key`/`file_url`, page name `Refined — <intent>`).

#### Case B — continue on the prior HTML file (`type: html`)

**Only when the file still exists at the pointer's path (relative to the project
root) and `frontend-design` is present.** Otherwise say so and go to Case C. Reuse
the SAME HTML file. Load the `frontend-design` skill FIRST (the HTML is the
customer's design surface), then write the `Refined` section (a
`<section id="refined">` or a "Refined" tab). If an earlier run of this stage
already added one, replace its content in place rather than adding another. Keep
it alongside the existing `Rough` section
— do not overwrite the rough section, so both rounds are visible in one file.
Persist `visual-mockups-ref-refined` (`type: html`, the same project-root-relative
file path, now carrying both sections).

#### Case C — a new surface (no usable prior ref, or the user chose a different surface)

The question above already offered what is available. Figma needs the MCP server
and the Figma skills, and account selection goes through `figma-create-new-file`.
HTML needs `frontend-design`. With nothing available, keep the markdown only and
write the pointer as `type: none` (see below).

1. **Reuse this stage's own earlier surface only if it is the same type.** If an
   earlier run of this stage already created a surface here in Case C, its type
   matches the type chosen this round, and it is still usable, update it instead
   of making another. Otherwise create the chosen type. For Figma that is the same `Refined — <intent>`
   page; for HTML, the same file's `Refined` section.
2. **Otherwise create it fresh.**
   - Figma: a `Refined — <intent>` page in a new file.
   - HTML: load the `frontend-design` skill FIRST, then write a new file with a
     `Refined` section in this stage's record dir.
3. **Verify a Figma render in-context**, as in Case A: `get_screenshot` with
   `enableBase64Response: true` (or `node.screenshot()` inside `use_figma`). Never
   use the default URL+curl path or `download_assets` to a local file.
4. **Persist `visual-mockups-ref-refined`.** An HTML path is relative to the
   project root.

For every case the design is a live pointer, never synced back into markdown; the
`Refined` page/section is what code-generation targets.

This plugin adds the pointer to the stage's `produces`, so it is a **required
output**: the stage's reviewer refuses a review while a required output is
missing. So the pointer is written in every run, with or without a visual.

Write `visual-mockups-ref-refined` in every case, overwriting any pointer an
earlier run left, in the same two-section shape as the rough round:
`## Mockup Visual Ref` (type and pointer) and `## Rendered From` (here
`mockups.md`, with its record path).

## fragment: before-step:6

### Step 5b (visual-mockups): Present the visual at the gate

If `visual-mockups-ref-refined` points at a visual (not `type: none`), present it in
the completion message BEFORE the approval gate: for `figma`, the `file_url`; for
`html`, the file path. Say what the surface holds. In Case A/B it carries both a
`Rough` and a `Refined` round. In Case C it is new and carries only `Refined`. The customer reviews the refined design and edits it in
place if desired; approving the gate approves the design as it currently stands.
