# graphify-plugin — start `reverse-engineering` from a Graphify map

Lets `reverse-engineering` (2.1) start from a map built by **Graphify**
(<https://github.com/Graphify-Labs/graphify>), which writes it to `<repo>/graphify-out/graph.json`.

🔴🔴 **A tree takes exactly ONE code-map plugin.** Two of them would hand the Developer two indexes
with two provenance chains at the same anchor. Nothing in compose enforces it — each plugin owns its
own sentinel — so it is a decision, and it belongs to whoever applies the tree. `README.md`
lists what is available and the prerequisite installer refuses a tree that carries two.

## Scope: Kiro (IDE and CLI) and Claude Code

The contribution prose uses `{{HARNESS_DIR}}`, which compose substitutes, so the converter and
rules-file paths it prints are right on either harness.

## What it installs

Three things, all additive:

| what | where it lands |
|---|---|
| two fragments in `reverse-engineering` (Inception): `Step 1b` before the Developer Code Scan, `Step 2b` before the Architect Synthesis | `<harness>/aidlc-common/stages/inception/reverse-engineering.md` |
| the converter `graphify-map.ts` | `<harness>/tools/graphify-map.ts` |
| the rules for treating a map, loaded by every inline and delegated agent | `<harness>/knowledge/aidlc-shared/external-code-map.md` |

No new stages, no new agents, no new scopes, no sensors. `stage-graph.json` does not move: the
contribution adds no `produces`/`consumes`.

Works for a single repo (or the workspace root) and for **multi-repo workspaces**: each repo has its
own map, its own converted files, and its own brief.

**Step 1b (before Developer Code Scan):** for each repo Step 1 selected for a scan, look for a
finished map, convert it, read its freshness row, and brief that repo's developer — the map as an
index, `graphify-out/` is not source, and which `graphify-*` files describe this repo. A repo
without a map gets a brief to ignore any `graphify-*` files left in the space knowledge.

**Step 2b (before Architect Synthesis):** name the same files and freshness row in the brief of the
link that writes that repo's artifacts.

## What it deliberately does NOT do

- **It does not install Graphify.** That is the user's move and it is deliberately theirs — the
  tool is theirs to own, upgrade and trust. `uv tool install "graphifyy[pdf,office,mcp]"` is the
  documented route; extras beyond the base are what add PDF, Office and MCP support.
- **It does not run `graphify kiro install`.** That command writes `.kiro/skills/` **and
  `.kiro/steering/graphify.md`**, and Kiro loads every file under `.kiro/steering/` always and
  unscoped. In an AI-DLC tree that directory holds exactly one file (`aidlc-active-memory.md`), so
  an extra always-on instruction there would reach all 33 stages outside the channels this
  framework governs. This plugin wires the same intent through the governed channels instead.
  ⭐ Kiro is also the one platform Graphify installs **no** tool hook for — the `PreToolUse`
  interception it ships for Claude Code, Codex, OpenCode and Gemini CLI does not apply here, so
  there is nothing competing with the stage protocol's own first-tool-call discipline.
- **It does not replace `reverse-engineering`.** That stage owns the CodeKB store and the store is
  the only structural surface later stages consume.
- **It does not restate the rules for using a map in the stage.** The fragment says WHERE and WHEN;
  `external-code-map.md` says HOW.
- **It does not edit an analysed repo's `.gitignore`.** `graphify-out/` belongs there before the
  workflow starts; changing it during the stage changes the source fingerprint, and under a strict
  policy CodeKB publishing then fails with `CODEKB_SOURCE_CHANGED`.

## 🔴 Measured schema notes — what the converter is built on

Measured from Graphify 0.9.54's own output on a 123-file Java+TypeScript corpus, not from its
prose docs. Three differences change what the slices can say:

| what | measured |
|---|---|
| top-level shape | NetworkX node-link: `{directed, multigraph, graph, nodes, links, hyperedges}` — the edge array is **`links`**, and the prose docs saying "edges" are wrong |
| project metadata | **absent** — `graph` is `{}` and there is no `project` block, so the converter synthesises provenance. 🔴 `built_at_commit` is **top-level**, not inside `graph`; reading it in the wrong place makes every commit-bearing map report as having none |
| per-node summary | **none** — the AST pass is a parse, not a reading |
| grouping | `community` integers from edge density, **unnamed** unless a separate LLM naming pass runs — which algorithm runs depends on the tool env's Python version |
| edge confidence | `confidence` ∈ `EXTRACTED` / `INFERRED` / `AMBIGUOUS` plus `confidence_score` |
| granularity | 746 nodes / 2167 links / 28 communities on the measured corpus — symbol level, not file level |

So the slices are built from **structure** — degree, community, path, relation kind, confidence —
rather than from sentences. The converter does not invent summaries or community names, and the
shared slice says so out loud, because an agent that reads a bare community number as a designed
module has been misled by us, not by the tool.

⭐ **The confidence column is what this tool buys us.** `external-code-map.md` requires confirming
a borrowed claim at the source before it reaches an artifact. With confidence tags that duty can be
spent where it is needed: an `EXTRACTED` edge already *is* a source citation, while `INFERRED` and
`AMBIGUOUS` are the tool's own deduction. The developer slice lists the latter two, highest score
first, with `source_file:source_location`.

## Build, test, install

Built with the engine's current plugin tools (`<tools-dir>` = the engine's `core/tools`). No compose
hook is vendored; the builder injects the bundled one.

```bash
bun test tests/                                                          # the converter, on synthetic repos
bun <tools-dir>/aidlc-plugin-validate.ts graphify-plugin                 # VALID, one compose-hook-absent warning
bun <tools-dir>/aidlc-plugin-build.ts   graphify-plugin <harness> <out>  # claude, kiro-ide, kiro, codex, …
bun <tools-dir>/aidlc-plugin-test.ts    graphify-plugin --install <project-root> --harness <harness>
```

Install the projection the host's way (`10-authoring-a-plugin.md` §5). On Kiro, drop the
projection's `.kiro` folder into the project and run
`aidlc engine plugin sync --harness-dir .kiro --plugin-root ./.kiro/aidlc-plugins/graphify-plugin`.

`ua-plugin` is an alternative: compose one of the two into a tree.

## Prerequisites (optional) — `prerequisites/`

A plugin cannot carry skills. `prerequisites/` holds the `aidlc-graphify-code-map` skill (how to run
Graphify on each repo and convert the results) and `INSTALL.md`, a procedure for the AI to follow
**after** the plugin is composed: detect the harness, find the plugin's marker in the stage file,
ask, copy the skill without overwriting, report leftovers of the older install and each repo's
`.gitignore` state. Neither the builder nor compose reads `prerequisites/` or `tests/`.

## Upgrading from 0.1.0

- 0.1.0 carried the pinned compose hook and `bundle:`, and could only be composed by running that
  hook directly. 0.2.0 uses `plugin:` only and no vendored hook, so `aidlc engine plugin sync`
  installs it.
- 0.1.0 needed an external installer for the rules file, a `GRAPHIFY_GUIDE.md` at the tree root and
  a `## External Code Map` section in `project.md`. 0.2.0 ships the rules file itself, and the skill
  is the whole procedure. `INSTALL.md` Step 4 lists what the old installer left; delete it once the
  plugin is composed.
- The skill no longer carries its own `scripts/graphify-map.ts`; it runs the plugin's converter.
- Converter output moved to per-repo names, and the stage gained `Step 2b`. Re-run the converter for
  each repo, then delete the old fixed-name files it lists.
- 🔴 **Delete `<harness>/tools/graphify-map.ts` before the first sync.** 0.1.0's compose left no
  ownership record, so sync treats that copy as someone else's file, refuses to overwrite it, and
  rolls the whole sync back (`collides with an existing file this plugin has no record of
  installing`, exit 1). With it deleted, sync installs 0.2.0 and replaces 0.1.0's fragment in place
  (measured on 2.11.1: one fragment, drops 0).

## Using the converter

```bash
bun <harness>/tools/graphify-map.ts <repo-dir> [<repo-dir> ...] --workspace . --space <active-space> [--dry-run]
```

Idempotent — run it again after every re-analysis; it prints each file with its byte size and
whether it changed. It writes one set of files per repo, and the repo name is in every file name and
every first heading:

| file | read by |
|---|---|
| `aidlc-shared/graphify-code-map.<repo>.md` | every agent — provenance, **freshness** (map commit vs the repo's HEAD at conversion), stack, areas, pointers |
| `<architect>/graphify-architecture.<repo>.md` | the architect — community structure, cross-community seams |
| `<developer>/graphify-structure.<repo>.md` | the developer — hub nodes, relations, hot files, edges to confirm |
| `<product>/graphify-documents.<repo>.md` | the product agent — **only when the map has non-code nodes** |

- **Converting one repo never touches another repo's files**, and two trees with the same directory
  name are refused rather than overwritten.
- **Files from 0.1.0** (`graphify-code-map.md` etc., no repo in the name) are named in the output,
  not deleted. Delete them once the per-repo files exist.

The last one is conditional on evidence, not configuration: Graphify's AST pass emits
`file_type: code` only, and document, paper, image and concept nodes appear once its semantic pass
has run over prose. With a code-only map that slice is not written at all.

⚠️ If the script reports **`no such agent in this workspace`** it exits non-zero and skips that
slice — that distribution's persona roster differs. Read `<harness>/agents/` for the real names.

## Freshness without git

Graphify omits `built_at_commit` entirely outside a git repository rather than writing a null (the
key is set only when a commit was resolved), and its incremental cache keys on **SHA256 of file
contents**. So a non-git source tree is a supported setup here, not a degraded one, and the
converter's provenance row says which of the two situations produced a missing commit. What a
non-git tree loses is only the opt-in `graphify hook install` auto-rebuild and the `graph.json`
union merge driver — both git features, neither required to build or query a map.
