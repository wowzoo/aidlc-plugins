---
target: code-generation
plugin: visual-mockups
adds:
  consumes:
    - artifact: visual-mockups-ref-refined
      required: false
    - artifact: visual-mockups-ref
      required: false
    - artifact: mockups
      required: false
    - artifact: wireframes
      required: false
fragments:
  - anchor: after-step:1
    order: 100
  - anchor: before-step:4
    order: 110
---

## fragment: after-step:1

### Step 1b (visual-mockups): Read the mockup for UI units

This applies ONLY to units of `kind: ui`. For non-UI units (spec / service /
packaging / library) there is nothing to do here — skip silently.

Read both layers for this unit, with paths, the same way Step 1 reads every other
input:

- **Mockup markdown** — `<record>/inception/refined-mockups/mockups.md` if it
  exists, otherwise `<record>/ideation/rough-mockups/wireframes.md`. This is the
  structural/behavioral spec: screen layout (S1..Sn), `data-testid`, accessibility
  notes.
- **Visual reference** — `<record>/inception/refined-mockups/visual-mockups-ref-refined.md`
  if it exists, otherwise `<record>/ideation/rough-mockups/visual-mockups-ref.md`.
  The two names are distinct on purpose: one artifact may have only one producer
  once it is consumed, so the refined round carries its own name.
  It is a POINTER — `type: figma` with `file_key`, `file_url` and the page name, or
  `type: html` with a file path — never the design itself. `type: none` means the
  user chose markdown only in that round: there is no visual for this unit. Do not
  fall back to the rough pointer when the refined one says `none`.

Both layers enter the developer subagent's prompt through Step 3b, before Step 4 delegates, not here. The
markdown layer travels even when no visual surface was produced (the user chose
neither Figma nor HTML), which is what closes the mockup→code path as an engine
contract rather than conductor discretion.

On a visual-vs-spec conflict, prefer the project's design-system tokens, adjusting
spacing/sizing minimally to match the visual. Never add a mockup — markdown or
visual — to a non-UI unit's prompt.

## fragment: before-step:4

### Step 3b (visual-mockups): Prepare the mockup for the Step 4 delegation prompt

For a `kind: ui` unit, prepare these now. When Step 4 builds its "Include in the
delegation prompt" list, add them to it **before you delegate**. Step 1b only read
them; a mockup that never enters the prompt never reaches the code.

- **The mockup markdown in full** — `mockups.md` when present, else
  `wireframes.md`.
- **The visual reference, when the pointer Step 1b picked exists and is not `type: none`** — its contents PLUS
  the retrieval instruction below, written into the prompt. A bare link is not the
  visual: the subagent cannot see the design unless it is told how to fetch it, and
  it does not auto-load the skills that would tell it.
  - **Which round:** use the round of the pointer Step 1b picked. A refined pointer
    means the `Refined` page or section; a rough pointer (refined made no visual)
    means the `Rough` one. With a refined pointer, the rough round is history.
  - `type: figma` — hand over `file_key`, `file_url` and **the page name recorded
    in the pointer**, and instruct: enumerate that page's
    frames with `get_metadata`, then per frame call `get_design_context` and
    `get_variable_defs`, and take spacing/color/typography from those results
    rather than guessing. Name the tools explicitly — do not write "use the Figma
    skills" and rely on the subagent finding them.
  - `type: html` — hand over the file path (relative to the project root, as the
    pointer records it) and instruct the subagent to read that file and work from
    the section of the pointer's round (`Refined` or `Rough`).
- **A closing report line** — instruct the subagent to end its response with one
  line naming what it actually read from the visual: the frame names it fetched
  (figma), the section it read (html), or `visual not read: <reason>`. Step 5's
  code summary carries that line forward. Without it, a consumed visual and an
  ignored one look identical in the record, and the next run cannot tell which
  happened.

If the visual cannot be retrieved — MCP server absent or disabled, tool call
denied, page or file missing — put the reason in that report line and continue from
the markdown alone. Degrading is allowed; degrading silently is not, because a
silent fallback reads afterwards as "the design was followed".
