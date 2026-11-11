# External Code Map

Some workspaces carry a machine-produced structural map of an existing codebase,
built by a tool outside AI-DLC (for example Understand-Anything writes one under
`<repo>/.ua/`, or one **workspace map** under `.ua/` at the root of a folder holding
several repos). This file says how to use one when it is there.

**This guidance is conditional.** If no such map exists in this workspace, ignore
this file — nothing here asks you to create one, and its absence is not a gap.

## Find it, do not guess

Look only at the repos this work is about, from the project root.

- With no recorded repo, the workspace root itself is the repo, so check `.ua`.
- Otherwise check `<repo>/.ua` for each repo in scope, and `.ua` at the root: in a
  workspace with recorded repos a root map is a workspace map whose paths start with
  the repo name.
- List the candidates rather than assuming a path:

```bash
ls .ua/knowledge-graph.json */.ua/knowledge-graph.json 2>/dev/null
```

A map that is mid-build has intermediates but no finished graph. Treat an
unfinished map as absent.

## One repo, one set of files

A workspace may hold several repos, each with its own map. A converted map lives in
the space knowledge as one set of files per repo, and **both the file name and the
first heading name the repo**:

| File | Heading |
|---|---|
| `aidlc-shared/ua-code-map.<repo>.md` | `# External code map — <repo> · orientation` |
| `aidlc-developer-agent/ua-structure.<repo>.md` | `… · structure` |
| `aidlc-architect-agent/ua-architecture.<repo>.md` | `… · architecture` |
| `aidlc-product-agent/ua-domains.<repo>.md` | `… · business domains` |

- **Use a file only for the repo it names.** Your knowledge preflight loads every
  repo's files; the ones naming another repo describe that repo, not yours.
- **Following a call into another repo is fine.** When the code you are reading calls
  into a sibling repo, that repo's files may show where to look. Confirm in that
  repo's source, and cite that file.
- **A file without a repo in its name** (`ua-code-map.md`, `ua-structure.md`, …) is
  left over from an older converter. Its heading still names the repo it describes;
  prefer the per-repo file when both exist.
- **A workspace map is split the same way.** Converted from the root, it yields the
  same per-repo files; the orientation file says "workspace map" and how much of the
  graph is this repo's. Its structure file also lists the **edges that cross into
  other repos** — follow them like any call into a sibling repo: confirm both ends in
  the source. A workspace map merged from per-repo maps (`mergedFrom` in its
  `meta.json`) may also leave inventories at the root of `.ua/` (endpoints, interfaces,
  repo-to-repo links); the orientation file lists them as guides. Same rules: an index,
  confirmed in the source before use.
- A brief that says to ignore the `ua-*` files for a scan overrides this section.

## Treatment rules

1. **It is evidence, not truth.** Before any claim from the map reaches an
   artifact, open the source file it points at and confirm the claim there.
2. **Cite the file you read** — the source file, not the map — so the claim
   carries a checkable origin.
3. **Use it as an index, not a substitute for reading.** Its value is deciding
   *which* files to open in a large codebase, not answering in their place.
4. **It is a snapshot.** The orientation file's `freshness` row says whether the
   map's commit was still HEAD when it was converted (for a workspace map: the commit
   recorded for that repo in `.ua/repo-heads.json`; **unknown** when none was recorded). When it says stale, or the
   working tree moved after that, re-derive what you need for changed files and say
   which parts you could not confirm.
5. **`.ua/` is not source.** It is the tool's own data — graphs, fingerprints,
   config, intermediates, guides. Do not analyse it, do not count it as code, and
   never list it in `code-structure` or `component-inventory`.
6. **It never replaces `reverse-engineering`.** That stage owns the CodeKB store,
   and the store is the only structural surface later stages consume. Never
   hand-write store artifacts from a map — the store's freshness fingerprint is
   minted by the tool, and a hand-written one fails verification.

## What it can inform

| CodeKB artifact | What the map usually helps with |
|---|---|
| `technology-stack` | languages, frameworks, build tooling actually present |
| `dependencies` | module and package edges; for calls across repos, the sibling repo's map |
| `code-structure` | directory and layer boundaries |
| `component-inventory` | modules, entry points, their sizes |
| `architecture` | how layers call each other; the interaction diagrams can start from the domain flows |
| `business-overview` | only if the tool extracted domain/flow information |
| `code-quality-assessment` | only what a guide left by the map run lists as issue candidates, each confirmed in the source |

Anything not in that table is still yours to establish by reading the code.
