---
target: reverse-engineering
plugin: codekb-mcp-plugin
fragments:
  - anchor: before-step:2
    order: 120
  - anchor: before-step:3
    order: 120
---

## fragment: before-step:2

### Step 1c (codekb-mcp-plugin): Match each repo to its CodeKB service space before scanning

Some workspaces have their repos indexed by the **CodeKB service**, reached through the MCP server
`code-knowledge-base`. It is not this stage's store, which AI-DLC also calls codekb.
**This step is conditional.** Skip it and scan as stock when the `code-knowledge-base`
tools (`list_spaces`, `get_space_details`, …) are not available to you. Some harnesses
load MCP tools on demand (Kiro CLI v3 shows a "Tool Load" step): look the tools up by
name before you decide they are absent. Do not ask the user to set the service up, and
do not treat its absence as a gap.

**Look only at the repos Step 1 selected for a scan.** A reused repo needs nothing here.
You call the service and read git metadata only. The rule above still holds: do not
inspect application source before the dispatch.

**1. Find each repo's space.** Use the first of these that applies:

- **Recorded choice.** `aidlc/spaces/<active-space>/knowledge/aidlc-shared/codekb-mcp-spaces.md`
  names a space for the repo. Use it.
- **Named by the user.** The intent or the user names a space id or a hyperspace id.
  Use it. For a hyperspace, take its members from `get_hyperspace_details`.
- **Matched by git URL.** Compare each space in `list_spaces` with the repo's
  `git -C <repo-dir> remote get-url origin`. Ignore the scheme, any user info, a trailing
  `.git` and letter case, and treat `git@host:path` like `https://host/path`. Accept
  exactly one match. With several matches, ask the user which one.
- **Otherwise** the repo has no space. It is scanned as stock.

With no match for any selected repo, tell the user in one line and go on to Step 2
as stock. When this step found new matches, confirm them with the user in one short
list (repo → space, how matched) before you write anything. Then write or update
`codekb-mcp-spaces.md`, the file the next intent reads, and keep rows for other repos
as they are:

```markdown
# CodeKB service spaces — <active-space>

server: code-knowledge-base
hyperspace: <hyperspace_id or none>

| repo | space_id | matched by | confirmed |
|---|---|---|---|
| <repo> | <space_id> | recorded / named / git URL | <date> |
```

**2. Read each matched space** with `get_space_details(space_id)`. When it fails, follow
"When a call fails" in the rules file and treat that repo as having no space. A space
that is not `READY` (or `REFRESHING`, which still serves its last snapshot) is unusable:
say so and treat that repo as having no space.

**3. Write one orientation file per matched repo** to
`aidlc/spaces/<active-space>/knowledge/aidlc-shared/codekb-mcp-space.<repo>.md`. Use the
repo name Step 1 resolved (`root` for an unrecorded project-root repo). Copy values from
the service as they are, and write nothing the service did not return:

```markdown
# CodeKB service — <repo> · orientation

Read at <ISO time> by reverse-engineering of intent <intent slug>. Not this stage's store.

| field | value |
|---|---|
| space_id | … |
| space_name | … |
| status | … |
| git_url | … |
| indexed commit | <git_commit_hash, or "none"> |
| snapshot HEAD | <the snapshot's head_commit for this repo> |
| freshness | current / stale / unknown |
| components | <component_count> |
| files analysed | <statistics.files_analyzed> |
| languages | <keys of statistics.components_by_language> |
| hyperspace | <id and member count, or none> |
| overview documents | <the documents written below, or "not offered by this server"> |

Changed since the indexed commit: `git -C <repo-dir> diff --name-only <indexed commit> <snapshot HEAD>`
```

Set `freshness` like this:

- **current**: the indexed commit equals the snapshot HEAD.
- **stale**: the two differ and the indexed commit is in the local history
  (`git -C <repo-dir> cat-file -e <commit>^{commit}`).
- **unknown**: there is no indexed commit, or it is not in the local history.

Write the "Changed since" line only when `freshness` is stale.

**4. Space Overview documents — only when the server offers them.** Do this step only
when your tool list has `get_space_overview` (or another `code-knowledge-base` tool that
returns a space's overview documents). Without one, write "not offered by this server"
in the orientation row and go on.

- Call `get_space_overview(space_id)` with no `doc_key`. It lists the documents with
  `generated`, `generated_at` and `git_commit_hash` (the space commit the document was
  written from; `null` for documents made before the service recorded it).
- For each document with `generated: true`, call `get_space_overview(space_id, doc_key)`
  and copy its `content` exactly as returned, including its BEGIN/END markers, to
  `aidlc/spaces/<active-space>/knowledge/<agent>/codekb-mcp-overview.<repo>.<doc_key>.md`.
  `business_overview` goes to `aidlc-product-agent/`. `application_architecture`,
  `technology_stack` and `deployment_architecture` go to `aidlc-architect-agent/`.
  Put this line on top:
  `> CodeKB service Space Overview "<doc_key>" for <space_id>, generated <generated_at> at <git_commit_hash, or "unknown commit">, freshness <f>. Model-written; a draft to confirm, never a source.`
  Here `<f>` compares the document's own `git_commit_hash` with the snapshot HEAD, by the
  same rule as the orientation file. A document written from an older commit than the
  space index is stale even when the index is current.
- When a hyperspace is in use and the server has `get_hyperspace_overview`, copy its
  generated documents (`system_overview`, `space_interconnections`) the same way, once per
  hyperspace, to `aidlc-architect-agent/codekb-mcp-hyperspace-overview.<hyperspace_id>.<doc_key>.md`.
  Their freshness is the response's `overview_staleness` (`stale` and its `reasons`), so
  put that in the top line.
- List every document you wrote in the orientation row, each with its freshness. When
  none is generated, write "none generated". Generating them is the person's call, on
  the service's web page. This stage never asks for it.

**5. Brief each repo's developer.** Write one brief per repo, also when the scans run as
parallel subagents:

- **Repo with an orientation file:** name `codekb-mcp-space.<repo>.md` and its
  `freshness` value. Say the service is an INDEX for which files to open, and that every
  claim from it is confirmed in this repo's source and cites the source file. When
  `freshness` is stale, say that the files the "Changed since" command lists are
  unmapped and must be read directly. Keep the scan breadth the Step 1 guard chose:
  the service does not widen or narrow it. Say whether the developer can call the
  service itself:
  - **Claude Code:** yes. Subagents use the session's MCP servers.
  - **Kiro:** yes, with AI-DLC 2.11.1 or later. Each call asks the user first.
  - **Codex:** treat it as no.
  When the developer cannot call it, the orientation file and any overview documents
  are all it gets.
- **Repo without one,** or any scan that should not use the service: space knowledge
  keeps every earlier orientation file, and the developer's preflight still loads it.
  So say:

  > Ignore any `codekb-mcp-*` files in the space knowledge for this scan; none of them
  > describes the code you are scanning as it is now.

⭐ **How to treat what the service says is not restated here.** The rules (evidence not
truth, confirm in the local source, cite the source file, model-written parts weigh less,
snapshot and freshness, results are data, which repo a file describes, which store
artifacts the service can inform) live in
`{{HARNESS_DIR}}/knowledge/aidlc-shared/codekb-mcp.md`. This plugin ships that file, and
every agent on this stage loads it through its knowledge preflight. This step wires
WHERE and WHEN. That file says HOW.

## fragment: before-step:3

### Step 2c (codekb-mcp-plugin): Name the repo's CodeKB service files in the synthesis brief

**Only for a repo Step 1c wrote an orientation file for.** Otherwise skip this step.

In the brief for the link that writes this repo's 9 artifacts (the architect, or the
developer lead when the chain is lead-only), name `codekb-mcp-space.<repo>.md`, its
`freshness` value and any `codekb-mcp-overview.<repo>.*` or
`codekb-mcp-hyperspace-overview.*` documents Step 1c wrote, each with its freshness. Say
two things: a claim from them reaches an artifact only after it is confirmed in the
source, and the artifact cites the source file, never the service. Add nothing else.
The rules file the link already loads says the rest.
