# graphify-plugin — start `reverse-engineering` from a Graphify map

Wires the same seam `ua-plugin` wires, for a different tool: **Graphify**
(<https://github.com/Graphify-Labs/graphify>), which writes its map to
`<repo>/graphify-out/graph.json`.

🔴🔴 **This plugin and `ua-plugin` are alternatives, not layers.** They contribute the same
anchor of the same stage for two different tools, and a tree that carried both would hand the
Developer two indexes with two provenance chains. **Compose exactly one of them into a tree.**
(Nothing enforces this — each plugin owns its own sentinel, so compose would happily land both.
It is a decision, and it belongs to whoever applies the tree.)

## Scope: Kiro unified agent harness (IDE 1.x · CLI v3) and Claude Code

The contribution prose uses `{{HARNESS_DIR}}`, which the compose hook substitutes, so the
converter path it prints is right on either harness. ⚠️ `ua-plugin` hardcodes `.kiro/` in the same
sentence — that is a defect in that plugin, not a convention to copy.

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

## 🔴 Measured schema notes — why the converter is not a copy of `ua-code-map.ts`

Measured from Graphify 0.9.54's own output on a 123-file Java+TypeScript corpus, not from its
prose docs. Three differences change what the slices can say:

| | Understand-Anything | Graphify |
|---|---|---|
| top-level shape | `{project, nodes, edges, layers, tour}` | NetworkX node-link: `{directed, multigraph, graph, nodes, links, hyperedges}` — the edge array is **`links`**, and the prose docs saying "edges" are wrong |
| project metadata | `project{name, languages, frameworks, description, analyzedAt, gitCommitHash}` | **absent** (`graph: {}` when there is no git) — the converter synthesises provenance from the graph |
| per-node summary | yes, LLM-written | **none** — the AST pass is deterministic and free |
| grouping | `layers[]`, named and described | Leiden `community` integers, **unnamed** unless a separate LLM naming pass runs |
| edge confidence | none | `confidence` ∈ `EXTRACTED` / `INFERRED` / `AMBIGUOUS` plus `confidence_score` |
| granularity (same corpus) | 137 nodes / 290 edges / 15 layers | 746 nodes / 2167 links / 28 communities — symbol level, not file level |

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

- **`aidlc-shared/external-code-map.md`** — the rules file the contribution points at. It is owned
  by `$ASSETS/custom-assets/knowledge/aidlc-shared/external-code-map.md` and landed by the
  prerequisite installer that step 3b of the apply procedure runs, so on a tree that carried
  `ua-plugin` first the file is already there.
  ⚠️ **That file's example sentence names Understand-Anything and `<repo>/.ua/`.** The rules
  themselves are tool-neutral — it is one example line — but on a Graphify tree that line points at
  the wrong tool. Fixing it means editing the owner asset, and the installer's `--check` mode
  compares that asset byte-for-byte against every tree already carrying it, so the edit has reach.
  It is a decision, not a typo fix: recorded here and left undone.

## Install

Follow `README.md` — the pre-flight, compose, prerequisite and verdict steps are the same,
with `graphify-plugin` in place of `ua-plugin`. The verdict table applies unchanged
except for the `ua-plugin` row: expect `tools/graphify-map.ts` installed and `stage-graph.json`
**unchanged**.

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

`hooks/compose.ts` is the same pinned template `ua-plugin` carries, byte-identical
(md5 `3dd2b7db0c44841efade53c4cbdefd8c`). Do not regenerate it from the current upstream template —
`README.md` records why.
