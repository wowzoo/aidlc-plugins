---
target: reverse-engineering
plugin: graphify-plugin
fragments:
  - anchor: before-step:2
    order: 100
  - anchor: before-step:3
    order: 100
---

## fragment: before-step:2

### Step 1b (graphify-plugin): Look for an external code map for each repo before scanning cold

Some workspaces carry a machine-produced structural map of the existing codebase,
built by a tool outside AI-DLC. Graphify writes one under `<repo>/graphify-out/`.
**This step is conditional** — with no map present, skip it and scan as the stock
step describes. Nothing here asks you to create one and its absence is not a gap.

**Look only at the repos Step 1 selected for a scan, from the project root.** A
reused repo needs nothing here.

- **Registered repos:** check `<repo>/graphify-out/` for each selected repo, the
  sibling directory the scan reads.
- **Unrecorded project-root repo:** check `graphify-out/` at the workspace root.
- **List the candidates rather than assuming a path:**

```bash
ls graphify-out/graph.json */graphify-out/graph.json 2>/dev/null
```

A map that is mid-build has a cache directory but no `graph.json`. **Treat an
unfinished map as absent.**

**Convert every selected repo that has a finished map**, once, before dispatching
its developer. Run from the project root. Each repo is converted on its own and its
files carry the repo name, so converting one repo leaves the others' files alone.
`<active-space>` is the space this workflow runs in, the one the directive and
`aidlc/active-space` name. The converter writes to `default` when `--space` is
omitted, so always pass it.

```bash
bun "{{HARNESS_DIR}}/tools/graphify-map.ts" "<repo-dir>" [<repo-dir> ...] --workspace "<workspace>" --space "<active-space>"
```

The converter runs on Bun. A native AI-DLC install does not need Bun, so it may be
missing: when `bun --version` fails, tell the user the map could not be converted
(installing Bun fixes it), treat every map as absent for this scan, and go on.

That writes provenance and facts into `aidlc/spaces/<active-space>/knowledge/`, one
set per repo: `aidlc-shared/graphify-code-map.<repo>.md` (orientation and pointers)
and the bulky slices with the agent that owns them (`graphify-structure.<repo>.md`,
`graphify-architecture.<repo>.md`, and `graphify-documents.<repo>.md` when the map
has non-code nodes). Add `--dry-run` first to see what it would write.
**Converting is what makes the map reach the delegated agents.** Their mandatory
knowledge preflight loads `aidlc/spaces/<active-space>/knowledge/aidlc-shared/` and
their own directory, so an unconverted `graphify-out/` is invisible to them.

Read the `freshness` row the converter wrote into `graphify-code-map.<repo>.md`.
When it says **stale**, the map predates the repo's HEAD: put that in the
developer's brief, so files changed since the map's commit are read as unmapped.
When it says **unknown**, say so in the brief and treat the map as possibly stale.

Then **brief each repo's developer** — one brief per repo, also when the scans run
as parallel subagents:

- **Repo with a converted map:** use the `graphify-*.<repo>.md` files for this repo
  as an INDEX. They decide *which* files to open in a large codebase, and the Scan
  Coverage section still reports what was actually read. Keep the scan breadth the
  Step 1 guard chose; a map does not widen or narrow it. Name the files in the
  brief, and say that `graphify-*` files naming another repo describe that repo, not
  this one.
- **Repo without a map**, or any scan that does not use a freshly converted map —
  space knowledge keeps every earlier conversion and the developer's preflight still
  loads it:

  > Ignore any `graphify-*.md` files in the space knowledge for this scan; none of
  > them is a map of the code you are scanning.

🔴 **In every brief — map used or not — tell the developer that `<repo>/graphify-out/` is NOT application source.**
It is the map's own output — a graph JSON, an HTML view, a markdown report and a
content-hash cache. Nothing excludes it automatically unless the repo's `.gitignore`
lists it: it is in neither of the source identity's exclusion lists (those cover
dependency and cache trees like `node_modules`, and generated names like
`build`/`dist`/`target`), and this stage hands the source surface to the developer
to discover rather than precomputing a file list. So say it in the brief:

> `graphify-out/` is generated output, not source. Do not analyse it, do not count it
> in Scan Coverage, and never cite it as a source file — cite the file it points at.

🔴 **Do not edit an analysed repo's `.gitignore` in this stage.** Step 1 has already
taken the source snapshot. Changing a file now changes the source fingerprint, and
under a strict guard policy publishing the CodeKB then fails with
`CODEKB_SOURCE_CHANGED`. The durable fix (`graphify-out/` in each analysed repo's
`.gitignore`) belongs before the workflow starts. If it is missing, mention it to
the user as a follow-up and rely on the brief above for this scan.

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
when you need one specific answer. Run it inside the repo whose map you are asking.
The lead agent's shell permission rules are an explicit allowlist, so if `graphify`
is not in it the call is denied; **check rather than assume**, and fall back to the
converted slices, which need no permission.

🔴 **The map never replaces this stage.** `reverse-engineering` owns the CodeKB store,
and that store is the only structural surface later stages consume. Never hand-write
store artifacts from a map: the store's freshness fingerprint is minted by the tool,
and a hand-written one fails verification.

⭐ **How to treat what the map says is not restated here.** The rules — evidence not
truth, confirm at the source before a claim lands, cite the source file rather than
the map, treat it as a snapshot, which repo a file describes, and which CodeKB
artifacts a map can inform — live in
`{{HARNESS_DIR}}/knowledge/aidlc-shared/external-code-map.md` — this plugin ships it, and
every delegated agent on this stage already loads it through its knowledge preflight.
This step wires WHERE and WHEN; that file says HOW.

## fragment: before-step:3

### Step 2b (graphify-plugin): Name the repo's map in the synthesis brief

**Only for a repo Step 1b converted.** Otherwise skip this step.

In the brief for the link that writes this repo's 9 artifacts — the architect, or
the developer lead when the chain is lead-only — name the same
`graphify-*.<repo>.md` files and the freshness row Step 1b used. Say that a claim
taken from them reaches an artifact only after it is confirmed in the source, and
that the artifact cites the source file, never the map. Add nothing else: the rules
file the link already loads says the rest.
