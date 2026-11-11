---
target: reverse-engineering
plugin: ua-plugin
fragments:
  - anchor: before-step:2
    order: 100
  - anchor: before-step:3
    order: 100
---

## fragment: before-step:2

### Step 1b (ua-plugin): Look for an external code map for each repo before scanning cold

Some workspaces carry a machine-produced structural map of the existing codebase,
built by a tool outside AI-DLC. Understand-Anything writes one under `<repo>/.ua/`,
or — when it was run once over the folder that holds the repos — a single
**workspace map** under `.ua/` at the workspace root, covering several repos.
**This step is conditional** — with no map present, skip it and scan as the stock
step describes. Nothing here asks you to create one and its absence is not a gap.

**Look only at the repos Step 1 selected for a scan, from the project root.** A
reused repo needs nothing here.

- **Registered repos:** check `<repo>/.ua/` for each selected repo, the sibling
  directory the scan reads, **and** `.ua/` at the workspace root. A root `.ua/` in a
  workspace with registered repos is a workspace map: one graph whose paths start
  with the repo name (`<repo>/src/...`).
- **Unrecorded project-root repo:** check `.ua/` at the workspace root.
- **List the candidates rather than assuming a path:**

```bash
ls .ua/knowledge-graph.json */.ua/knowledge-graph.json 2>/dev/null
```

A map that is mid-build has intermediates but no finished graph. **Treat an
unfinished map as absent.**

**Convert every selected repo that has a finished map**, once, before dispatching
its developer. A workspace map is converted by passing the workspace root itself:
the converter splits it by repo and writes the same per-repo files as below, for
every repo that appears in it — so the rest of this step reads the same. When the
root `.ua/meta.json` carries `mergedFrom`, the workspace map was built FROM the
per-repo maps (and adds the edges between repos): convert the root only and leave
the per-repo maps alone. Otherwise, when a repo has both its own `<repo>/.ua/` and a
part in the workspace map, convert only the one whose `freshness` row the user
prefers (the newer one by default); the later conversion overwrites the earlier one's
files. Run from the project root. Each repo is converted on its own and its
files carry the repo name, so converting one repo leaves the others' files alone.
`<active-space>` is the space this workflow runs in, the one the directive and
`aidlc/active-space` name. The converter writes to `default` when `--space` is
omitted, so always pass it.

```bash
bun "{{HARNESS_DIR}}/tools/ua-code-map.ts" "<repo-dir>" [<repo-dir> ...] --workspace "<workspace>" --space "<active-space>"
bun "{{HARNESS_DIR}}/tools/ua-code-map.ts" . --workspace . --space "<active-space>"     # a workspace map at the root
```

The converter runs on Bun. A native AI-DLC install does not need Bun, so it may be
missing: when `bun --version` fails, tell the user the map could not be converted
(installing Bun fixes it), treat every map as absent for this scan, and go on.

That writes provenance and facts into `aidlc/spaces/<active-space>/knowledge/`, one
set per repo: `aidlc-shared/ua-code-map.<repo>.md` (orientation and pointers) and
the bulky slices with the agent that owns them (`ua-structure.<repo>.md`,
`ua-architecture.<repo>.md`, `ua-domains.<repo>.md`). Add `--dry-run` first to see
what it would write. **Converting is what makes the map reach the delegated
agents.** Their mandatory knowledge preflight loads
`aidlc/spaces/<active-space>/knowledge/aidlc-shared/` and their own directory, so
an unconverted `.ua/` is invisible to them.

Read the `freshness` row the converter wrote into `ua-code-map.<repo>.md`. When it
says **stale**, the map predates the repo's HEAD: put that in the developer's
brief, so files changed since the map's commit are read as unmapped. A workspace map
anchors freshness to `.ua/repo-heads.json` (each repo's HEAD when the map was built,
written by the person with `ua-code-map.ts --record-heads .`); when that file is
missing the row says **unknown** — say so in the brief and treat the map as possibly
stale.

Then **brief each repo's developer** — one brief per repo, also when the scans run
as parallel subagents:

- **Repo with a converted map:** use the `ua-*.<repo>.md` files for this repo as an
  INDEX. They decide *which* files to open in a large codebase, and the Scan
  Coverage section still reports what was actually read. Keep the scan breadth the
  Step 1 guard chose; a map does not widen or narrow it. Name the files in the
  brief, and say that `ua-*` files naming another repo describe that repo, not this
  one.
- **Repo without a map**, or any scan that does not use a freshly converted map —
  space knowledge keeps every earlier conversion and the developer's preflight still
  loads it:

  > Ignore any `ua-*.md` files in the space knowledge for this scan; none of them is
  > a map of the code you are scanning.

🔴 **In every brief — map used or not — tell the developer that `<repo>/.ua/` (and a root `.ua/`) is NOT application source.** It is the
map's own data directory — graph JSON, a fingerprint baseline, config, an ignore file,
scan intermediates, guides and a trash dir. Nothing excludes it automatically unless
git ignores it (the repo's `.gitignore` or `.git/info/exclude`), and this stage hands the source surface to the
developer to discover rather than precomputing a file list. So say it in the brief:

> `.ua/` is the code-map tool's own data, not source. Do not analyse it, do not count
> it in Scan Coverage, and never cite it as a source file — cite the file it points at.

🔴 **Do not edit an analysed repo's `.gitignore` in this stage.** Step 1 has already
taken the source snapshot. Changing a file now changes the source fingerprint, and
under a strict guard policy publishing the CodeKB then fails with
`CODEKB_SOURCE_CHANGED`. The durable fix (`.ua/` in each analysed repo's
`.gitignore`, or its `.git/info/exclude`) belongs before the workflow starts. If it is missing, mention it to
the user as a follow-up and rely on the brief above for this scan. A workspace map
sits outside every repo, so it needs no `.gitignore` entry.

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

### Step 2b (ua-plugin): Name the repo's map in the synthesis brief

**Only for a repo Step 1b converted.** Otherwise skip this step.

In the brief for the link that writes this repo's 9 artifacts — the architect, or
the developer lead when the chain is lead-only — name the same `ua-*.<repo>.md`
files and the freshness row Step 1b used. Say that a claim taken from them reaches
an artifact only after it is confirmed in the source, and that the artifact cites
the source file, never the map. Add nothing else: the rules file the link already
loads says the rest.
