---
target: reverse-engineering
# `bundle:` is what our pinned compose reads; `plugin:` is what the current
# upstream validator requires (`stage-owner`). Both are carried so the plugin
# satisfies today's compose and validates against today's contract.
bundle: ua-plugin
plugin: ua-plugin
fragments:
  - anchor: before-step:2
    order: 100
---

## fragment: before-step:2

### Step 1b (ua-plugin): Look for an external code map before scanning cold

Some workspaces carry a machine-produced structural map of the existing codebase,
built by a tool outside AI-DLC. Understand-Anything writes one under `<repo>/.ua/`.
**This step is conditional** — with no map present, skip it and scan as the stock
step describes. Nothing here asks you to create one and its absence is not a gap.

**List the candidates rather than assuming a path:**

```bash
ls -d */.ua 2>/dev/null
ls */.ua/knowledge-graph.json 2>/dev/null
```

A map that is mid-build has intermediates but no finished graph. **Treat an
unfinished map as absent.**

When a finished map is present, convert it once, before dispatching the developer:

```bash
bun .kiro/tools/ua-code-map.ts <analyzed-repo> --workspace <workspace> [--space default]
```

That writes provenance and facts into `aidlc/spaces/<space>/knowledge/` — orientation
plus pointers under `aidlc-shared/`, and the bulky slices with the agent that owns
them. Add `--dry-run` first to see what it would write. **Converting is what makes
the map reach the delegated agents**: their mandatory knowledge preflight loads
`aidlc/spaces/<space>/knowledge/aidlc-shared/` and their own directory, so an
unconverted `.ua/` is invisible to them.

Then **brief the developer to use the map as an INDEX** — it decides *which* files to
open in a large codebase, and the Scan Coverage section still reports what was
actually read. Keep the scan breadth the Step 1 guard chose; a map does not widen or
narrow it.

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
