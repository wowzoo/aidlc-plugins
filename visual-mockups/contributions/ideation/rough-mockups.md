---
target: rough-mockups
plugin: visual-mockups
adds:
  produces:
    - visual-mockups-ref
  required_sections:
    - "Mockup Visual Ref"
fragments:
  - anchor: after-step:4
    order: 100
  - anchor: before-step:6
    order: 110
---

## fragment: after-step:4

### Step 4b (visual-mockups): Offer a visual mockup — Figma, HTML, or neither

After the wireframes/user-flow markdown is written, OFFER the user a visual
rendering — a markdown wireframe is not how a customer judges a design. Present
three choices and let the user pick:

- **Figma** — a live design file the customer views and edits in the browser.
- **HTML** — a single self-contained HTML preview (no external account needed).
- **Neither** — keep the markdown wireframes only.

Availability gates the offer: only propose **Figma** when the Figma MCP server is
connected AND the Figma skills are present (`figma-use`, `figma-generate-design`,
`figma-create-new-file`). **HTML needs no MCP server and no Figma account**, but it
is not prerequisite-free either — it requires the `frontend-design` skill, which the
HTML step below instructs you to load first, so only propose **HTML** when that
skill is present. If the user has no Figma account/plan or the MCP server is
absent, offer HTML (or neither) — do not force Figma. When neither surface is
available, say so, keep the markdown wireframes only, and write the pointer as
`type: none` (see Persist).

#### If the user chooses Figma

1. **Create the design file — this is where the account/organization is chosen.**
   Load the `figma-create-new-file` skill FIRST, then create one `design` file
   (suggested name: `<intent>-mockups`). Its plan-resolution runs `whoami`: a
   single plan is used automatically; **with more than one plan/organization the
   skill asks which team or org to create the file in.** Do not hardcode a plan.
   If file creation fails because there is no usable account, tell the user why.
   Then fall back to the HTML path below when `frontend-design` is present;
   otherwise keep the markdown wireframes only and write the pointer as
   `type: none` (see Persist).
2. **Render the `Rough — <intent>` page.** With the returned `file_key`, load
   `figma-use` (and `figma-generate-design` for a whole view) and render the
   wireframes onto a page named with a `Rough — ` prefix (e.g. `Rough — <intent>`)
   so the round is unambiguous when the refined page is added later. Reuse any
   published design-system components/variables the file exposes. To verify the
   render, keep the check in-context: call `get_screenshot` with
   `enableBase64Response: true` (or `node.screenshot()` inside `use_figma`) so the
   PNG returns inline. Do NOT take the tool's default URL+curl path or
   `download_assets` to a local file. `curl` is not on AI-DLC's command allowlist,
   so it would stop for an extra approval. And this plugin persists a pointer to
   the live file, never a downloaded copy.
3. **Persist the pointer** (see "Persist" below) with `type: figma`, the
   `file_key`, the `file_url`, and the page name.

#### If the user chooses HTML

1. Load the `frontend-design` skill FIRST — the HTML preview is what the customer
   judges the design by, so the visual should read as intentional, not a templated
   default. Then write a single self-contained HTML file (inline CSS, no external
   deps) to this stage's record dir, e.g. `rough-mockup.html`, laying out the
   wireframe screens so the customer can open it in a browser. Put the rough
   screens under a clearly labelled `Rough` section (a `<section id="rough">` or a
   "Rough" tab) — the refined stage will add a `Refined` section to this SAME file,
   so structure it to hold both rounds.
2. **Persist the pointer** with `type: html` and the file path **relative to the
   project root** (for example
   `aidlc/spaces/<space>/intents/<intent>/ideation/rough-mockups/rough-mockup.html`).
   The refined round and code-generation read the pointer from other directories,
   so a record-relative path would point at the wrong place.

#### Persist — always write the pointer

This plugin adds the pointer to the stage's `produces`, so it is a **required
output**: the stage's reviewer refuses a review while a required output is
missing. So the pointer is written in every run, with or without a visual.

Write `visual-mockups-ref` to this stage's engine-resolved record dir with two
sections. Overwrite any pointer an earlier run of this stage left. Under
`## Mockup Visual Ref`, record:

- `type`: `figma` or `html`, or `none` when this round made no visual. With `none`,
  add the reason: the user chose markdown only, no surface was available, or
  creating it failed.
- for `figma`: `file_key`, `file_url`, and the current page name
- for `html`: the file path, relative to the project root

Under `## Rendered From`, name the markdown artifact the visual renders
(`wireframes.md`, with its record path). Keep both headings: the stage's
`required-sections` sensor expects at least two `##` sections in every output.

Store the POINTER, not a copy of the design. For Figma the file is the live
surface; for HTML the file itself is the artifact. AI-DLC never syncs the visual
back into the markdown — the mockup markdown remains the structural/behavioral
spec, the visual ref is the fidelity surface.

#### If the user chooses neither

Do not create a visual. Write the pointer as `type: none` with the reason (see
Persist). That also stops a pointer from an earlier run from leading
code-generation to an old design. Proceed with the markdown artifacts as normal.
The markdown mockup still reaches code-generation (see the code-generation
contribution) — a visual ref is an enhancement, not a requirement.

## fragment: before-step:6

### Step 5b (visual-mockups): Present the visual at the gate

If `visual-mockups-ref` points at a visual (not `type: none`), present it in the
completion message BEFORE the approval gate: for `figma`, the `file_url`
(openable + editable in the browser, link stable across edits); for `html`, the
file path to open locally. The mockup gate IS the design-fix point — approving
the gate approves the design as it currently stands in the referenced Figma page
/ HTML file. With `type: none`, say that this round has no visual surface and
the gate approves the markdown wireframes.
