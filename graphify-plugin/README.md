# graphify-plugin — start `reverse-engineering` from a Graphify map

Lets `reverse-engineering` (2.1) start from a map built by **Graphify**
(<https://github.com/Graphify-Labs/graphify>), which writes it to `<repo>/graphify-out/graph.json`.

🔴🔴 **A tree takes exactly ONE code-map plugin.** Two of them would hand the Developer two indexes
with two provenance chains at the same anchor. Nothing in compose enforces it — each plugin owns its
own sentinel — so it is a decision, and it belongs to whoever applies the tree. `README.md`
lists what is available and the prerequisite installer refuses a tree that carries two.

## Scope: Kiro unified agent harness (IDE 1.x · CLI v3) and Claude Code

The contribution prose uses `{{HARNESS_DIR}}`, which the compose hook substitutes, so the converter
path it prints is right on either harness.

## What it installs

Two things, both additive:

| what | where it lands |
|---|---|
| one contribution to `reverse-engineering` (Inception), anchor `before-step:2` | `<harness>/aidlc-common/stages/inception/reverse-engineering.md` |
| the converter `graphify-map.ts` | `<harness>/tools/graphify-map.ts` |

No new stages, no new agents, no new scopes, no sensors. `stage-graph.json` does not move: the
contribution adds no `produces`/`consumes`.

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
- **It does not restate the rules for using a map.** Those live in
  `aidlc/spaces/<space>/knowledge/aidlc-shared/external-code-map.md`.

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

## 🔴 What the plugin seam cannot carry

Valid `aidlc.contributes` keys are `stages · overlays · agents · scopes · sensors · knowledge ·
tools`, `memory` is refused by the validator, and the pinned compose actually installs only
`stages`, `sensors` and `tools`. So one prerequisite is not carried here:

- **the rules file, the method document and the skill** — `aidlc-shared/external-code-map.md`,
  `GRAPHIFY_GUIDE.md` at the tree root, and `<harness>/skills/aidlc-graphify-code-map/`. All three are
  landed by the prerequisite installer (`$ASSETS/scripts/apply_external_code_map.py`), which reads this
  plugin's sentinel out of the composed stage file and installs the Graphify asset set for it — so the tree's prose, its rules
  and its skill all name the same tool. Assert with `--check`.
  ⭐ That installer touches **no always-on instruction file**: `AGENTS.md` and `CLAUDE.md` stay
  byte-identical to stock, because a pointer there is paid by every stage while the skill's own
  `description` and `GRAPHIFY_GUIDE.md` cost nothing.

## Install

Follow `README.md` — the pre-flight, compose, prerequisite and verdict steps are the same,
naming `graphify-plugin`. The verdict table applies unchanged except for its code-map row:
expect `tools/graphify-map.ts` installed and `stage-graph.json` **unchanged**.

## Using the converter

```bash
bun <harness>/tools/graphify-map.ts <analyzed-repo> --workspace . [--space default] [--dry-run]
```

Idempotent — run it again after every re-analysis; it prints each file with its byte size and
whether it changed. It writes:

| file | read by |
|---|---|
| `aidlc-shared/graphify-code-map.md` | every agent — provenance, stack, areas, pointers |
| `<architect>/graphify-architecture.md` | the architect — community structure, cross-community seams |
| `<developer>/graphify-structure.md` | the developer — hub nodes, relations, hot files, edges to confirm |
| `<product>/graphify-documents.md` | the product agent — **only when the map has non-code nodes** |

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

## Pinned compose hook

`hooks/compose.ts` is the pinned template every plugin here carries, byte-identical across them
(md5 `3dd2b7db0c44841efade53c4cbdefd8c`). Do not regenerate it from the current upstream template —
`README.md` records why.
