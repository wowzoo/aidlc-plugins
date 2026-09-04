---
target: rough-mockups
bundle: visual-mockups
adds:
  produces:
    - mockup-visual-ref
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
HTML step below instructs you to load first. If the user has no Figma account/plan
or the MCP server is absent, offer HTML (or neither) — do not force Figma.

#### If the user chooses Figma

1. **Create the design file — this is where the account/organization is chosen.**
   Load the `figma-create-new-file` skill FIRST, then create one `design` file
   (suggested name: `<intent>-mockups`). Its plan-resolution runs `whoami`: a
   single plan is used automatically; **with more than one plan/organization the
   skill asks which team or org to create the file in.** Do not hardcode a plan.
   If file creation fails because there is no usable account, fall back to the
   HTML path below.
2. **Render the `Rough — <intent>` page.** With the returned `file_key`, load
   `figma-use` (and `figma-generate-design` for a whole view) and render the
   wireframes onto a page named with a `Rough — ` prefix (e.g. `Rough — <intent>`)
   so the round is unambiguous when the refined page is added later. Reuse any
   published design-system components/variables the file exposes. To verify the
   render, keep the check in-context: call `get_screenshot` with
   `enableBase64Response: true` (or `node.screenshot()` inside `use_figma`) so the
   PNG returns inline. Do NOT take the tool's default URL+curl path or
   `download_assets` to a local file — the `/aidlc` sandbox grants neither `curl`
   nor a system temp dir (a `/tmp` write is refused), and this plugin persists a
   pointer to the live file, never a downloaded copy.
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
2. **Persist the pointer** with `type: html` and the file path (relative to the
   record dir).

#### Persist — a single visual pointer (both paths)

Write `mockup-visual-ref` to this stage's engine-resolved record dir under a
`## Mockup Visual Ref` heading. Record:

- `type`: `figma` or `html`
- for `figma`: `file_key`, `file_url`, and the current page name
- for `html`: the file path

Store the POINTER, not a copy of the design. For Figma the file is the live
surface; for HTML the file itself is the artifact. AI-DLC never syncs the visual
back into the markdown — the mockup markdown remains the structural/behavioral
spec, the visual ref is the fidelity surface.

#### If the user chooses neither

Do not create `mockup-visual-ref`. Proceed with the markdown artifacts as normal.
The markdown mockup still reaches code-generation (see the code-generation
contribution) — a visual ref is an enhancement, not a requirement.

## fragment: before-step:6

### Step 5b (visual-mockups): Present the visual at the gate

If `mockup-visual-ref` was created, present it in the completion message BEFORE
the approval gate: for `figma`, the `file_url` (openable + editable in the
browser, link stable across edits); for `html`, the file path to open locally.
The mockup gate IS the design-fix point — approving the gate approves the design
as it currently stands in the referenced Figma page / HTML file.
