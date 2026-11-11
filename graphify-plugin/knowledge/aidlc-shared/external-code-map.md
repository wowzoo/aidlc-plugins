# External Code Map

Some workspaces carry a machine-produced structural map of an existing codebase,
built by a tool outside AI-DLC (for example Graphify writes one under
`<repo>/graphify-out/`). This file says how to use one when it is there.

**This guidance is conditional.** If no such map exists in this workspace, ignore
this file — nothing here asks you to create one, and its absence is not a gap.

## Find it, do not guess

Look only at the repos this work is about, from the project root.

- With no recorded repo, the workspace root itself is the repo, so check
  `graphify-out`.
- Otherwise check `<repo>/graphify-out` for each repo in scope.
- List the candidates rather than assuming a path:

```bash
ls graphify-out/graph.json */graphify-out/graph.json 2>/dev/null
```

A map that is mid-build has a `cache/` directory but no `graph.json`. Treat an
unfinished map as absent.

## One repo, one set of files

A workspace may hold several repos, each with its own map. A converted map lives in
the space knowledge as one set of files per repo, and **both the file name and the
first heading name the repo**:

| File | Heading |
|---|---|
| `aidlc-shared/graphify-code-map.<repo>.md` | `# External code map — <repo> · orientation` |
| `aidlc-developer-agent/graphify-structure.<repo>.md` | `… · structure` |
| `aidlc-architect-agent/graphify-architecture.<repo>.md` | `… · architecture` |
| `aidlc-product-agent/graphify-documents.<repo>.md` | `… · documents and concepts` (only when the map has non-code nodes) |

- **Use a file only for the repo it names.** Your knowledge preflight loads every
  repo's files; the ones naming another repo describe that repo, not yours.
- **Following a call into another repo is fine.** When the code you are reading calls
  into a sibling repo, that repo's files may show where to look. Confirm in that
  repo's source, and cite that file.
- **A file without a repo in its name** (`graphify-code-map.md`,
  `graphify-structure.md`, …) is left over from an older converter. Its heading
  still names the repo it describes; prefer the per-repo file when both exist.
- A brief that says to ignore the `graphify-*` files for a scan overrides this
  section.

## Treatment rules

1. **It is evidence, not truth.** Before any claim from the map reaches an
   artifact, open the source file it points at and confirm the claim there.
2. **Cite the file you read** — the source file, not the map — so the claim
   carries a checkable origin.
3. **Use it as an index, not a substitute for reading.** Its value is deciding
   *which* files to open in a large codebase, not answering in their place.
4. **It is a snapshot.** The orientation file's `freshness` row says whether the
   map's commit was still HEAD when it was converted (**unknown** when the map
   records no commit). When it says stale, or the working tree moved after that,
   re-derive what you need for changed files and say which parts you could not
   confirm.
5. **`graphify-out/` is not source.** It is the tool's own output — graph JSON, an
   HTML view, a report, a content-hash cache. Do not analyse it, do not count it as
   code, and never list it in `code-structure` or `component-inventory`.
6. **It never replaces `reverse-engineering`.** That stage owns the CodeKB
   store, and the store is the only structural surface later stages consume.
   Never hand-write store artifacts from a map — the store's freshness
   fingerprint is minted by the tool, and a hand-written one fails verification.

## Spend the confirmation where it is needed

Every edge in this map carries a `confidence` tag, and rule 1 costs less when you
read it:

| tag | what it means | what rule 1 asks of you |
|---|---|---|
| `EXTRACTED` | stated in the source — an import, a resolved call | it already *is* a source citation; re-deriving buys nothing |
| `INFERRED` | the tool deduced it (second-pass resolution, co-occurrence) | confirm at `source_file` before a claim rests on it |
| `AMBIGUOUS` | the tool flagged it for human review itself | confirm, and say so if you keep it |

`confidence_score` accompanies the inferred ones. This narrows the confirmation
duty; it does not remove it — the artifact still cites the source file.

## What it can inform

| CodeKB artifact | What the map usually helps with |
|---|---|
| `technology-stack` | languages and frameworks actually present in the paths |
| `dependencies` | module and package edges, `imports` / `depends_on` |
| `code-structure` | directory boundaries, and the tool's own community grouping |
| `component-inventory` | the highest-degree nodes and where they sit |
| `architecture` | which communities reach into which |
| `business-overview` | only when the map has non-code nodes (docs, papers) |

Anything not in that table is still yours to establish by reading the code.

## Two absences to expect

- **No per-node summary.** This tool's code pass is a deterministic parse, not a
  reading, so nodes carry structure and no prose. A node without a description is
  not a defect and not a gap in your analysis.
- **No named grouping.** Communities are computed from edge density and are
  numbered, not named. **Do not read a community number as a designed module**, and
  do not invent a name for one — open the files it holds instead.
