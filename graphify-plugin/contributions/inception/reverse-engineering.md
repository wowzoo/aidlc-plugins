---
target: reverse-engineering
# `bundle:` is what our pinned compose reads; `plugin:` is what the current
# upstream validator requires (`stage-owner`). Both are carried so the plugin
# satisfies today's compose and validates against today's contract.
bundle: graphify-plugin
plugin: graphify-plugin
fragments:
  - anchor: before-step:2
    order: 100
---

## fragment: before-step:2

### Step 1b (graphify-plugin): Look for an external code map before scanning cold

Some workspaces carry a machine-produced structural map of the existing codebase,
built by a tool outside AI-DLC. Graphify writes one under `<repo>/graphify-out/`.
**This step is conditional** — with no map present, skip it and scan as the stock
step describes. Nothing here asks you to create one and its absence is not a gap.

**List the candidates rather than assuming a path:**

```bash
ls -d */graphify-out 2>/dev/null
ls */graphify-out/graph.json 2>/dev/null
```

A map that is mid-build has a cache directory but no `graph.json`. **Treat an
unfinished map as absent.**

When a finished map is present, convert it once, before dispatching the developer:

```bash
bun {{HARNESS_DIR}}/tools/graphify-map.ts <analyzed-repo> --workspace <workspace> [--space default]
```

That writes provenance and facts into `aidlc/spaces/<space>/knowledge/` — orientation
plus pointers under `aidlc-shared/`, and the bulky slices with the agent that owns
them. Add `--dry-run` first to see what it would write. **Converting is what makes
the map reach the delegated agents**: their mandatory knowledge preflight loads
`aidlc/spaces/<space>/knowledge/aidlc-shared/` and their own directory, so an
unconverted `graphify-out/` is invisible to them.

Then **brief the developer to use the map as an INDEX** — it decides *which* files to
open in a large codebase, and the Scan Coverage section still reports what was
actually read. Keep the scan breadth the Step 1 guard chose; a map does not widen or
narrow it.

⭐ **Spend confirmation where the map says it is needed.** Every edge this tool emits
carries a confidence tag: `EXTRACTED` means the relationship is stated in the source
(an import, a resolved call), `INFERRED` means it was deduced, and `AMBIGUOUS` means
the tool itself flagged it for review. The converter reports the breakdown and lists
the inferred edges it considers load-bearing. Confirm those at the source first; an
`EXTRACTED` edge is already a source citation, so re-deriving all of them buys
nothing. **This narrows the confirmation duty, it does not remove it** — the artifact
still cites the source file, never the map.

⚠️ **A query surface exists, but only if this workspace granted it.** Where the tool's
CLI is permitted, `graphify query "<question>" --budget <n>` returns a scoped subgraph
and `graphify path "A" "B"` traces how two things connect — cheaper than reading files
when you need one specific answer. The lead agent's shell permission rules are an
explicit allowlist, so if `graphify` is not in it the call is denied; **check rather
than assume**, and fall back to the converted slices, which need no permission.

🔴 **The map never replaces this stage.** `reverse-engineering` owns the CodeKB store,
and that store is the only structural surface later stages consume. Never hand-write
store artifacts from a map: the store's freshness fingerprint is minted by the tool,
and a hand-written one fails verification.

⭐ **How to treat what the map says is not restated here.** The rules — evidence not
truth, confirm at the source before a claim lands, cite the source file rather than
the map, treat it as a snapshot, and which CodeKB artifacts a map can inform — live in
`aidlc/spaces/<space>/knowledge/aidlc-shared/external-code-map.md`, which every
delegated agent on this stage already loads. This step wires WHERE and WHEN; that file
says HOW.
