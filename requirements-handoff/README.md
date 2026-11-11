# requirements-handoff

A no-code path for a **product owner**: one improvement request in, the
requirements and screen design a delivery team builds from out. One scope runs
the core stages that make that package (reverse engineering only for existing
code), one stage turns the refined mockups into a clickable wireframe
prototype, and a last stage gathers everything into one development request.

## What it adds

| What | Name |
|---|---|
| Scope | `requirements-handoff-po` — intent-capture, feasibility, scope-definition, rough-mockups, approval-handoff, reverse-engineering (existing code only), requirements-analysis, user-stories, refined-mockups, then the prototype and the development request |
| Stage | `requirements-handoff-prototype` (inception, after refined-mockups, CONDITIONAL) — writes `index.html` and `requirements-handoff-prototype-notes.md` in its record dir |
| Stage | `requirements-handoff-request-form` (inception, last, ALWAYS) — writes `requirements-handoff-request-form.md` and the same content as `development-request.md`, the file the product owner sends |
| Artifacts | `requirements-handoff-prototype-notes` — the behaviours the prototype had to decide; `requirements-handoff-request-form` — the development request |

The core stages join the scope through `contributions/<phase>/<stage>.md`
(`adds.scopes`): a scope's `include_stages` cannot name core stages. The
contributions carry no prose, so there are no anchors to drift.

The prototype stage asks no questions and has no reviewer. It skips itself when
the request has no screen (notifications or system integration only). Its
report counts screens, states and notes items from the files it wrote.

## The development request

Twelve sections, in this order: request summary, problem and goal, scope,
current system (existing code only), requirement summary by type,
requirements, screens, research and options, privacy and security,
assumptions/dependencies/risks, open questions, attachments. Every value cites
its artifact. The stage decides nothing new and asks no questions.

The section list is this plugin's own synthesis of public documents, with no
text copied: the North Carolina Department of Information Technology's IT
Procurement Intake Form guidance (summary and detailed sections), Korea's
Ministry of Science and ICT public software RFP example (overview, current
state, requirement summary, detailed requirements), and NIPA's requirements
detailing guide (requirement types and per-requirement fields). The stage file
lists them under "Sources".

## Reverse engineering

`reverse-engineering` joins the scope like the other core stages. It is a core
CONDITIONAL stage, so the workspace scan decides (measured on 2.11.2):

| Project folder | Plan |
|---|---|
| no code | `reverse-engineering — SKIP` (greenfield), 10 stages |
| code in the folder, or in a repo up to three levels below it | `EXECUTE`, 11 stages |
| `--skip reverse-engineering` in the start command | `SKIP` |
| no code in the folder, but RE is wanted | add `--project-type brownfield` |

The scan looks only inside the project folder: clone the code under it, or add
`--project-type brownfield`.

## Use

```
/aidlc --scope requirements-handoff-po <the request, and that no code is to be written>
```

Unknown answers are expected: a product owner does not know where data lives or
how the target system is built. The scope tells the stages to record those as
open items for the requester or the delivery team instead of guessing.

## Build, check and install

```bash
bun <tools-dir>/aidlc-plugin-validate.ts requirements-handoff      # VALID, one compose-hook-absent warning
bun <tools-dir>/aidlc-plugin-test.ts     requirements-handoff --install <project-root> --harness <harness>
uv run python scripts/package-plugin.py --tools <tools-dir> --out <dir> requirements-handoff
```

Install from the zip as in the root README ("Distribute"). Nothing here needs
`prerequisites/`.

- On Kiro, the zip's INSTALL.md composes the plugin once by hand. Kiro stops a
  hook with no `timeout` after 60 seconds; builds made with 2.11.3 or later give
  the Kiro IDE compose hook `"timeout": 1800`, and that build passes doctor on
  2.11.2 and 2.11.3 (measured). Never edit the hook file by hand: AI-DLC knows a
  plugin's hook only in the form the builder writes, and a re-serialised copy
  fails doctor with `Native command trust is incomplete` (measured on 2.11.2).
- On Codex, the prototype stage's runner lands in `.agents/skills/` and enters
  AI-DLC's source boundary, as AI-DLC's own runners do. Install between intents.
- After install, doctor warns that `<H>/skills/aidlc/tables.md` changed and that
  `aidlc config` stops. It does not stop (measured on 2.11.2); never use
  `aidlc config --force` for it.

## With visual-mockups

Both write HTML from the mockups: visual-mockups a preview at rough-mockups and
refined-mockups, this plugin one clickable prototype after refined-mockups. They
compose side by side but do not know about each other, so a project carrying
both gets both files.
