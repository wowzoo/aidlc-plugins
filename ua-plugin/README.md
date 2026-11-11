# ua-plugin — start `reverse-engineering` from a map, not a cold scan

An AI-DLC plugin. When a repo the intent scans carries a machine-produced structural map built by a
tool outside AI-DLC — Understand-Anything writes one under `<repo>/.ua/` — this plugin makes
`reverse-engineering` use that repo's map as an **index** for deciding which files to open, and makes
every claim borrowed from it get confirmed in the source file before it reaches a CodeKB artifact.

Works for a single repo (or the workspace root) and for **multi-repo workspaces**: each repo has its
own map, its own converted files, and its own brief. A multi-repo workspace may instead carry **one
workspace map** — Understand-Anything run once at the folder holding the repos, `.ua/` at the root,
paths `<repo>/...` — which the converter splits into the same per-repo files.

Overlay-only and additive: no new stages, no new artifacts.

## What it installs

| Path | What |
|---|---|
| `<harness>/aidlc-common/stages/inception/reverse-engineering.md` | two spliced fragments: `Step 1b` before the Developer Code Scan, `Step 2b` before the Architect Synthesis |
| `<harness>/tools/ua-code-map.ts` | the converter: turns each repo's finished `.ua/` map into per-repo knowledge files, split per agent |
| `<harness>/knowledge/aidlc-shared/external-code-map.md` | the rules for treating a map, loaded by every inline and delegated agent |

`stage-graph.json` does not change — the plugin adds no `produces`/`consumes`, because
`reverse-engineering` already produces every artifact a map can inform.

**Step 1b (before Developer Code Scan):** for each repo Step 1 selected for a scan, look for a
finished map, convert it, read its freshness row, and brief that repo's developer — the map as an
index, `.ua/` is not source, and which `ua-*` files describe this repo.

**Step 2b (before Architect Synthesis):** name the same files and freshness row in the brief of the
link that writes that repo's artifacts.

## The converter

The converter runs on **Bun**. A native AI-DLC install does not ship or need Bun, so install it
where the workflow runs (`bun --version`). Without it, Step 1b says so and the stage scans as stock.

```bash
bun <harness>/tools/ua-code-map.ts <repo-dir> [<repo-dir> ...] --workspace <workspace> --space <active-space> [--dry-run]
bun <harness>/tools/ua-code-map.ts <map-root> --workspace <workspace> --space <active-space>   # workspace map
bun <harness>/tools/ua-code-map.ts --record-heads <map-root>                                  # right after the analysis
```

It writes provenance and facts only, one set of files per repo. The repo name is in every file name
and every first heading:

| File | Holds |
|---|---|
| `aidlc/spaces/<space>/knowledge/aidlc-shared/ua-code-map.<repo>.md` | provenance, **freshness** (map commit vs the repo's HEAD at conversion), stack, layer names, tour titles, guides the map run left in `.ua/` (by path), pointers |
| `.../aidlc-architect-agent/ua-architecture.<repo>.md` | layer descriptions, node census |
| `.../aidlc-developer-agent/ua-structure.<repo>.md` | hot files, relationship census, `<prefix>:<value>` tag prefixes, import fan-out, the tour |
| `.../aidlc-product-agent/ua-domains.<repo>.md` | domains in full, flows as a list (steps stay in `domain-graph.json`) |

- **Converting one repo never touches another repo's files**, and two trees with the same directory
  name are refused rather than overwritten.
- **Files from 0.2.0 and earlier** (`ua-code-map.md` etc., no repo in the name) are named in the
  output, not deleted. Delete them once the per-repo files exist.
- **An owner-only map stays owner-only:** when the map file has no group/other permission bits, the
  converted files get none either.
- A slice whose agent is not in the workspace roster is skipped and the run exits 1.
- **Workspace map** (a map root that is not a git checkout and whose nodes sit under child repos):
  split by the first path segment; layers and tour steps keep only that repo's nodes; domains follow
  their steps' files (a domain graph whose steps carry no file paths goes to every repo whole, and says
  so). Each repo's structure file adds **edges across repos** by direction, other repo and edge type.
  A non-git root has no commit, so `--record-heads <map-root>` writes `.ua/repo-heads.json` with each
  repo's HEAD; freshness is measured against it, and reads **unknown** without it. A workspace map can
  also be MERGED from per-repo maps by an outside tool (its `meta.json` then has `mergedFrom`, and its
  `repo-heads.json` holds each repo map's own commit); Step 1b converts such a root only.

Measured on two real maps (a ~170-file SQL repo and a ~11k-file Java repo with a 36 MB graph):
0.2 s, eight files, 136 KB in total. The largest is the Java repo's product slice at 55 KB (10
domains in full, 59 flows) — the product agent loads it in every stage it works on.

## What it deliberately does NOT do

- **It does not replace `reverse-engineering`.** That stage owns the CodeKB store, and the store is
  the only structural surface later stages consume. The store's freshness fingerprint is minted by
  the tool; a hand-written one fails verification.
- **It does not install Understand-Anything** and does not require it. Every step is conditional on
  a finished map; with no map the stage scans as stock.
- **It does not edit an analysed repo's ignore rules.** Git must ignore `.ua/` before the workflow
  starts — through the repo's `.gitignore` or, without a commit, its `.git/info/exclude`
  (`git check-ignore -q .ua/` succeeds either way; AI-DLC's source scan uses git's ignore rules).
  Changing `.gitignore` during the stage changes the source fingerprint, and under a strict policy
  CodeKB publishing then fails with `CODEKB_SOURCE_CHANGED`.
- **It does not restate how to treat a map in the stage.** The fragments say WHERE and WHEN;
  `external-code-map.md` says HOW.

## Prerequisites (optional) — `prerequisites/`

A plugin cannot carry skills. `prerequisites/` holds the `aidlc-external-code-map` skill (how to run
Understand-Anything on each repo and convert the results) and `INSTALL.md`, a procedure for the AI
to follow **after** the plugin is composed: detect the harness, find the plugin's marker in the
stage file, ask, copy the skill without overwriting, and report whether git ignores each repo's `.ua/`.
Neither the builder nor compose reads `prerequisites/` or `tests/` (checked: no file from either
lands in the claude, kiro-ide or codex projection).

## Build, test, install

Built with the engine's current plugin tools (`<tools-dir>` = the engine's `core/tools`). No compose
hook is vendored; the builder injects the bundled one.

```bash
bun <tools-dir>/aidlc-plugin-validate.ts ua-plugin                 # VALID, one compose-hook-absent warning
bun <tools-dir>/aidlc-plugin-build.ts   ua-plugin <harness> <out>  # claude, kiro-ide, kiro, codex, …
bun <tools-dir>/aidlc-plugin-test.ts    ua-plugin --install <project-root> --harness <harness>
bun test tests/                                                    # the converter, on synthetic repos
```

Install the projection the host's way (`10-authoring-a-plugin.md` §5). On Kiro, drop the
projection's `.kiro` folder into the project and run
`aidlc engine plugin sync --harness-dir .kiro --plugin-root ./.kiro/aidlc-plugins/ua-plugin`.

Results on 2026-10-21, against AI-DLC `origin/main` (`f8b25cd`) and the v2.11.1 release: validate
`VALID`; test `CLEAN` on Claude Code and Kiro IDE (drops 0, graph compiled, idempotent second
compose); the fragments bind to `Step 2: Developer Code Scan` and `Step 3: Architect Synthesis`.

`graphify-plugin` is an alternative: compose one of the two into a tree.

## Upgrading from 0.3.0

- 0.4.0 adds the workspace map (above) and `--record-heads`. Per-repo maps convert exactly as before.
- 0.4.3 accepts `.git/info/exclude` as well as `.gitignore` for ignoring `.ua/`, and the skill
  converts only the root when the workspace map was merged from per-repo maps (`mergedFrom`).
  Brought in from the Modernization Kit's copy. The fragment text changed, so sync replaces it in
  place; the converter is unchanged.

## Upgrading from 0.2.0 or 0.1.0

- 0.1.0 carried the pinned compose hook and `bundle:`. 0.3.0 uses `plugin:` only and no vendored
  hook, and ships the rules file itself (0.1.0 needed an external installer for it).
- Converter output moved to per-repo names. Re-run the converter for each repo, then delete the old
  fixed-name files it lists.
- 🔴 **From 0.1.0, delete `<harness>/tools/ua-code-map.ts` before the first sync.** 0.1.0's compose
  left no ownership record, so sync treats that copy as someone else's file, refuses to overwrite
  it, and rolls the whole sync back (`collides with an existing file this plugin has no record of
  installing`, exit 1). With it deleted, sync installs the new version and replaces 0.1.0's fragment
  in place.
- **From 0.2.0 or 0.3.0** (installed by sync): an unchanged installed tool is replaced. A copy edited
  after install stops the sync (`owned path changed since composition`, exit 1); move it out of the
  way and sync again.
- 0.1.0's external installer also left a `## External Code Map` section in `project.md`,
  `UNDERSTANDING_GUIDE.md` at the tree root and an older rules file under
  `aidlc/spaces/<space>/knowledge/aidlc-shared/`. `prerequisites/INSTALL.md` Step 4 lists what is
  left; delete it once the plugin is composed, or agents read two versions of the rules.

Measured on AI-DLC v2.11.1 (2026-10-26): 0.1.0 → 0.4.0 and 0.2.0 → 0.4.0, with the bundled `aidlc`
binary's `engine plugin sync`.
