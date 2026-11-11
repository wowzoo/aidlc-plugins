---
slug: requirements-handoff-prototype
name: Wireframe Prototype
plugin: requirements-handoff
number: "2.10"
phase: inception
execution: CONDITIONAL
condition: Execute when refined-mockups produced mockups.md with at least one screen (M-xx); skip for a request that has only notifications or system integration and no screen
lead_agent: aidlc-design-agent
support_agents: []
mode: inline
produces:
  - requirements-handoff-prototype-notes
consumes:
  - artifact: mockups
    required: true
  - artifact: interaction-spec
    required: true
  - artifact: stories
    required: false
  - artifact: requirements
    required: false
  - artifact: design-system-mapping
    required: false
requires_stage:
  - refined-mockups
sensors: []
scopes:
  - requirements-handoff-po
ars:
  targets: [ua]
  cost: 2
inputs: mockups.md, interaction-spec.md and design-system-mapping.md from refined-mockups, stories.md from user-stories, requirements.md from requirements-analysis
outputs: index.html and requirements-handoff-prototype-notes.md (under this stage's record dir, engine-resolved)
---

# Wireframe Prototype

Turn the refined mockups into one clickable wireframe the product owner can
show the requester before the package goes to the delivery team. The prototype
checks the flow, not the look: `mockups.md` stays the source of truth.

This stage asks no questions. Everything it needs is in the upstream
artifacts; where they are silent, it decides, builds, and writes the decision
down for the requester and the delivery team to confirm.

## Steps

### Step 1: Load the upstream artifacts

Read the consumed artifacts at the paths the directive gives:

- `mockups.md` and `interaction-spec.md` (refined-mockups) — required
- `stories.md` (user-stories) and `requirements.md` (requirements-analysis) — for the IDs in Step 3 rule 4
- `design-system-mapping.md` (refined-mockups) — for the colours and fonts in Step 3 rule 2, when it names any

Do not edit any of them, and do not restart or re-run an earlier stage.

### Step 2: Decide what kind of prototype this is

- Screens (M-xx) in `mockups.md`: build the screens (Step 3).
- A conversational chatbot request: build the conversation flow as screens,
  one state per turn the interaction spec defines.
- Notifications or system integration only, with no screen: build no HTML.
  Write only the notes file (Step 4), stating at the top why there is no
  prototype, and go to Step 5.

### Step 3: Build `index.html`

Write a single `index.html` in this stage's record directory, next to the notes
file. HTML, CSS, and JavaScript only, inline in that one file: no CDN, no web
font, no image file (small inline SVG icons are fine). It must work when opened
straight from disk in a browser.

1. Carry over every screen (M-xx) and every state in `mockups.md`. Buttons and
   controls move between states exactly as `interaction-spec.md` defines. Add
   no feature or wording the documents do not have.
2. A calm, finished-looking product screen in a neutral palette, so the flow
   reads clearly. A dark, slim band across the top says, in the conversation
   language, that this is a prototype for checking the flow, not the final
   design, and that the source is `mockups.md`.
   - **Colour:** define every colour once as a CSS custom property in `:root`.
     Light grey page background (about `#f6f7f9`), white cards, hairline
     borders (about `#dfe3e8`), near-black text (about `#1f2633`) and a
     secondary grey for labels (about `#5b6473`). Use **one** accent (a blue
     such as `#1f5fae`, with a pale tint) for the primary action, the selected
     item and the current step, and nothing else. Status colours appear only on
     status: green for done, amber for in progress or waiting, red for errors,
     each as dark text on a pale tint of the same hue. No gradients.
   - **Design system:** when `design-system-mapping.md` names the product's
     colours or font, use them for the accent and the font stack instead, and
     keep everything else above. Never download a font.
   - **Type:** `system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic",
     "Noto Sans KR", sans-serif`; a monospace stack for IDs and codes;
     tabular numbers for amounts. Body 14–15px, and clear steps for page title,
     section title, body and caption.
   - **Shape and space:** 8px radius on cards, 6px on buttons and inputs, pill
     badges. One soft shadow, on the main card only. Spacing on a 4px grid,
     with room between sections.
   - **Controls:** primary button filled with the accent, secondary button
     outlined; inputs with a visible border; a progress or timeline that fills
     done and current steps with the accent and leaves later steps neutral;
     empty and error states as a short panel with the message and its action.
   - **States:** hover, a 2px accent `:focus-visible` outline, and disabled.
     Transitions only on colour and background, 150ms or less.
3. An area the documents mark as an assumption gets a dashed border in violet
   on a pale violet tint, and a small label meaning "assumption". Violet is used
   for nothing else.
4. Each screen shows, small in a corner, its screen ID with the related
   requirement and story IDs, for example `M-04 · FR4.1 · US4.1`.
5. A screen list on the left jumps to any screen and any state.
6. Sample data uses the example values in `mockups.md`.

Write all UI text in the workflow's conversation language.

### Step 4: Write `requirements-handoff-prototype-notes.md`

List what the prototype had to decide because the documents did not say, what
it does differently from the documents, and what it left out. Open the file
with one line, in the conversation language, saying that these are behaviours
the prototype decided where the documents were silent, for the requester and
the delivery team to confirm.

Tag every item with the related screen ID and requirement and story IDs. These
items are new open questions for the requester and the delivery team, not
fixes to the upstream artifacts.

### Step 5: Report and hand to the approval gate

Before you report, read `index.html` and `requirements-handoff-prototype-notes.md`
back from disk and count from those files, not from what you meant to write.
Count each notes item once, and when the file groups items by kind, give the
count per kind as well as the total.

Tell the product owner, in the conversation language:

- how many screens and states the prototype has, and how many notes items there are;
- where `index.html` is and that it opens directly in a browser;
- that the notes items are questions to confirm with the requester and the delivery team.

Then complete the stage through the normal stage protocol.
