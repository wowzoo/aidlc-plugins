# code-map — start `reverse-engineering` from a map, not a cold scan

An AI-DLC plugin. When a workspace carries a machine-produced structural map of an
existing codebase built by a tool outside AI-DLC — Understand-Anything writes one
under `<repo>/.ua/` — this plugin makes `reverse-engineering` (2.1) use it as an
**index** for deciding which files to open, and makes every claim borrowed from it
get confirmed in the source file before it reaches a CodeKB artifact.

Overlay-only and additive: no new stages, no new artifacts, one contribution to one
stage plus the converter tool.

## Scope: Kiro unified agent harness (IDE 1.x · CLI v3) and Claude Code

The contribution prose and the tool are harness-neutral. `compose` installs into
whichever harness directory it is pointed at (`AIDLC_HARNESS_DIR`).

## What it installs

| Path | What |
|---|---|
| `<harness>/aidlc-common/stages/inception/reverse-engineering.md` | one spliced fragment — `Step 1b`, before the Developer Code Scan |
| `<harness>/tools/ua-code-map.ts` | the converter: turns a finished `.ua/` map into the workspace knowledge overlay, split per agent |

Nothing else. `stage-graph.json` does not change — the plugin adds no
`produces`/`consumes`, because stage 2.1 already produces every artifact a map can
inform.

## What it deliberately does NOT do

- **It does not replace `reverse-engineering`.** That stage owns the CodeKB store,
  and the store is the only structural surface later stages consume. The store's
  freshness fingerprint is minted by the tool; a hand-written one fails
  verification. The plugin says this in the stage prose so a conductor reading only
  the stage file still sees it.
- **It does not install Understand-Anything** and does not require it. Everything
  the fragments say is conditional on a finished map being present; with no map they
  instruct the agent to skip and scan as stock.
- **It does not restate how to treat a map.** Those rules — evidence not truth,
  confirm at the source, cite the source file, snapshot caveat, which CodeKB artifacts
  a map can inform — belong to
  `aidlc/spaces/<space>/knowledge/aidlc-shared/external-code-map.md`. This plugin
  wires WHERE and WHEN; that file says HOW. Duplicating it would put one rule in two
  channels.

## 🔴 What the plugin seam cannot carry — measured, not assumed

A plugin's valid `aidlc.contributes` keys are `stages`, `overlays`, `agents`,
`scopes`, `sensors`, `knowledge`, `tools` (`memory` is present but the validator
refuses it: *"not supported by the current plugin projection"*). So four pieces of
the external-code-map wiring have **no channel**. They are installed by
`apply_external_code_map.py`, run as step 3b of the apply procedure in
`../README.md`; the owner originals live in the installer's asset tree
(`$ASSETS/custom-assets/` and `$ASSETS/custom-skills/aidlc-external-code-map/`) and
are not part of this repository. No layer of the distributed tree ships them —
this plugin plus that driver is the whole mechanism.

| Piece | Why the seam cannot carry it |
|---|---|
| the `aidlc-external-code-map` skill | there is no `skills` contribution key |
| the `## External Code Map` section in `aidlc/spaces/<space>/memory/project.md` | that is the `memory` key, explicitly refused |
| the workspace-root `UNDERSTANDING_GUIDE.md` | not a content dir at all |
| the shared rules file under `aidlc/spaces/<space>/knowledge/aidlc-shared/` | `knowledge` is a valid key, but the pinned `compose.ts` installs only `stages`, `sensors` and `tools` |

⭐ **So this plugin does not try to be the whole wiring — it is the conductor-side
half.** The knowledge file reaches the *delegated agents*: the developer and architect
personas carry a **mandatory** "Delegated knowledge preflight" that loads
`aidlc/spaces/<space>/knowledge/aidlc-shared/` and their own directory, so a
`pipeline` stage like `reverse-engineering` is covered even though it gets no
`inline_context_paths` roster. That is why the spliced fragment is trimmed to
WHERE/WHEN only. What the knowledge channel cannot do is tell the **conductor** to
look for a map, convert it, and brief the developer — those are steps in the stage
procedure, and the stage file is what this plugin can reach.

## Install

```bash
AIDLC_PLUGIN_ROOT=<this dir> AIDLC_PROJECT_DIR=<workspace> AIDLC_HARNESS_DIR=.kiro \
  bun <this dir>/hooks/compose.ts
```

`compose` prints nothing on success. Judge by outcome, not exit code: two
`<!-- plugin:code-map:… -->` sentinels and two `### Step Nb (code-map)` headings in
the stage file, `tools/ua-code-map.ts` present, `stage-graph.json` unchanged, and
`doctor` / `graph compile --check` the same as before.

## Using the converter

```bash
bun <harness>/tools/ua-code-map.ts <analyzed-repo> --workspace <workspace> [--space default] [--dry-run]
```

It writes provenance and facts — orientation plus pointers under `aidlc-shared/`,
bulky slices with the agent that owns them, no content duplicated. The rules for
*using* a map are the stage fragments this plugin splices; the converter's output
carries facts only.

## Pinned compose hook

`hooks/compose.ts` is a pinned older generation of the template (673 lines, md5
`3dd2b7db0c44841efade53c4cbdefd8c`, byte-identical to the sibling
`visual-mockups` copy) and is **not** regenerated from the current bundled
template. `aidlc-plugin-validate.ts` reports one error for this
(`compose-hook-stale`); it is expected — the sibling plugin reports the same one.
Every other validator rule passes. See `../README.md` for why.

⚠️ The contribution frontmatter carries **both** `bundle:` and `plugin:`. The pinned
compose reads `bundle:`; the current validator's `stage-owner` rule requires
`plugin:`. Carrying both satisfies today's compose and today's contract.
