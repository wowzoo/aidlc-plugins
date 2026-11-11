# codekb-mcp-plugin — use the CodeKB service on an existing codebase

An AI-DLC plugin. When a workspace's repos are indexed by the **CodeKB service** (the code knowledge
base behind the MCP server `code-knowledge-base`), this plugin connects that service to AI-DLC at
three stages:

- `reverse-engineering` uses each repo's space as an **index**;
- `requirements-analysis` finds what the change touches;
- `functional-design` finds what the unit must keep or change.

Every claim taken from the service is confirmed in the local source file before it reaches an
artifact, and the artifact cites that file.

🔴 **Not AI-DLC's codekb.** `reverse-engineering` writes a local store at
`aidlc/spaces/<space>/codekb/<repo>/` that AI-DLC also calls codekb. The two are unrelated. The store
stays the only structural surface later stages consume, and this plugin never writes it.

Overlay-only and additive: no new stages, no new artifacts, no tool.

## What it installs

| Path | What |
|---|---|
| `<harness>/aidlc-common/stages/inception/reverse-engineering.md` | `Step 1c` before the Developer Code Scan, `Step 2c` before the Architect Synthesis |
| `<harness>/aidlc-common/stages/inception/requirements-analysis.md` | `Step 2b` before Determine Depth |
| `<harness>/aidlc-common/stages/construction/functional-design.md` | `Step 1b` before Create Functional Design Plan |
| `<harness>/knowledge/aidlc-shared/codekb-mcp.md` | the rules for treating what the service returns, loaded by every inline and delegated agent |

`stage-graph.json` does not change. The plugin adds no `produces` or `consumes`.

**Step 1c (reverse-engineering).** For each repo Step 1 selected for a scan, it finds the repo's
space, in this order:

1. a space recorded in `codekb-mcp-spaces.md`;
2. a space or hyperspace the user named;
3. a match between the space's `git_url` and the repo's `origin`.

The person confirms new matches. The conductor then writes one orientation file per repo, with the
metadata the service returned and a `freshness` row. It copies Space Overview documents only when
the server offers a tool for them, and briefs the developer. The conductor reads only the service
and git metadata, never application source, as the stock step requires.

**Step 2c (reverse-engineering).** It names the same files in the brief of the link that writes the
repo's artifacts.

**Step 2b (requirements-analysis) and Step 1b (functional-design).** Both stages run inline, so the
conductor queries the service itself:

- **localize:** semantic search, then confirm each hit in the source;
- **ripple:** walk the incoming dependents, and repeat the semantic search in the other spaces for
  links that are not call edges.

The confirmed list goes into the stage's own questions file under
`## Existing code affected (CodeKB service)`. The questions file keeps it across turns and across
functional-design's QUESTION-ONLY and ARTIFACT-ONLY modes. From there it reaches `requirements.md`
or `functional-spec.md`.

## Files it writes at run time

All under `aidlc/spaces/<active-space>/knowledge/`, which every agent's knowledge preflight loads:

| File | Written by | What |
|---|---|---|
| `aidlc-shared/codekb-mcp-spaces.md` | Step 1c, after the person confirms (or the person, in advance) | repo → space, hyperspace, how each match was made |
| `aidlc-shared/codekb-mcp-space.<repo>.md` | Step 1c, every scan | `# CodeKB service — <repo> · orientation`: space metadata, indexed commit, snapshot HEAD, `freshness` |
| `aidlc-product-agent/` or `aidlc-architect-agent/codekb-mcp-overview.<repo>.<doc>.md` | Step 1c, only when the server has `get_space_overview` | a Space Overview document, verbatim, marked as model-written, with its own commit and freshness |
| `aidlc-architect-agent/codekb-mcp-hyperspace-overview.<hyperspace>.<doc>.md` | Step 1c, with a hyperspace and `get_hyperspace_overview` | system overview / space interconnections, verbatim, with the service's staleness verdict |

`freshness` is `current` (indexed commit = snapshot HEAD), `stale` (different, and the indexed
commit is in local history, so `git diff --name-only` lists the unmapped files) or `unknown` (a ZIP
space, or a commit the local clone does not have).

## What it deliberately does NOT do

- **It does not replace `reverse-engineering`** and never writes the store.
- **It does not index anything.** Spaces are created on the service (web UI or REST) by a person
  allowed to upload that code. The plugin only reads them.
- **It does not inspect application source in the conductor before the scan.** That stays the
  developer's job (stock rule).
- **It does not restate how to query.** The server sends its own usage guide when a client
  connects. `codekb-mcp.md` adds only the AI-DLC rules.
- **It does not generate Space Overview documents**, and it reads them only where the server has
  `get_space_overview` / `get_hyperspace_overview`. Upstream CodeKB (8754994) serves them over REST
  and the web UI only. The two MCP tools were added to the labs instance on 2026-11-10 (read-only,
  same READ gates as REST, each document with the commit it was written from). Without them Step 1c
  writes "not offered by this server" and moves on. Documents made before that deployment report
  no commit, so their freshness is `unknown` until they are generated again.

## Harnesses

| | Conductor (inline stages, Step 1c) | Delegated developer (RE scan) | AI-DLC composer (stock) |
|---|---|---|---|
| Claude Code | the session's servers | uses the session's servers (subagents inherit them) | same |
| Kiro IDE · Kiro CLI v3 | sees it (`includeMcpJson: true` on every AI-DLC agent file) | same | same |
| Kiro CLI V2 | sees it after one `aidlc config`, which writes `@code-knowledge-base` into all 15 agent JSONs | same | same |
| Codex | the session's servers | treated as not reaching it (not measured) | not measured |

On Kiro this holds from AI-DLC 2.11.1 (upstream `93118a5`, #2535); before it only the conductor
saw an added server. Every call asks the person first: AI-DLC does not add the server to
`allowedTools`. No agent file is edited by hand, and a hand edit would make the next
`aidlc config` stop on that file. Measured: the 15 kiro-ide agent files carry `includeMcpJson: true`
on 2.11.3 and 2.11.4, and on a 2.11.4 Kiro CLI V2 tree `aidlc config` wrote the grant into the
conductor, composer, developer and architect JSONs with no conflict. Not measured: a real Kiro
session calling the server.

## Combining with other plugins

- **`ua-plugin` / `graphify-plugin`:** different knowledge file and sentinels. Step 1c and 2c sit
  at the same anchors as their Step 1b and 2b, with a later `order` (120 vs 100). Composing one of
  them alongside is possible; the Modernization Kit ships them as separate variants instead.
- **`visual-mockups`, `project-overview`, `requirements-handoff`:** no shared stage anchors except
  `requirements-handoff`'s scope, which includes reverse-engineering and requirements-analysis.

## Prerequisites — `prerequisites/`

`prerequisites/INSTALL.md` is a procedure the AI follows after compose:

1. ask for the endpoint;
2. check it answers (`curl`, no credentials);
3. register `code-knowledge-base` the harness's way;
4. on Kiro CLI V2, run `aidlc config` once so the agents get the grant (Kiro IDE and v3 need nothing);
5. report how to finish and check the login.

## Build, test, install

Same as every plugin here (repo `README.md`, "Apply" and "Distribute"):

```bash
bun <tools-dir>/aidlc-plugin-validate.ts codekb-mcp-plugin            # VALID, one compose-hook-absent warning
uv run python scripts/check-plugin-anchors.py --pre <tree> --plugin-root codekb-mcp-plugin
uv run python scripts/package-plugin.py --tools <tools-dir> --out <dir> codekb-mcp-plugin
```

## Changes

- **0.1.3** (2026-11-11), from a live run (Kiro CLI 3.2.0 on a remote Linux host, AI-DLC 2.11.3, the
  labs CodeKB instance): INSTALL registers the server with `kiro-cli mcp add --scope workspace`
  (Kiro CLI v3 refuses the AI's direct write to `.kiro/settings/mcp.json`, `Source: kiro-scope`)
  and says how to log in from a remote host (pinned `oauth.redirectUri`, tunnel first). The tool
  check looks MCP tools up by name before deciding they are absent (Kiro v3 loads them on demand).
  RE writes "Changed since" only when stale. Functional Design calls `show_dependencies` on the
  unit's own edit sites instead of only re-reading the requirements list.
- **0.1.2** (2026-11-11): no agent-file edit on Kiro. From AI-DLC 2.11.1 every Kiro agent sees
  the servers the person adds (V2 after one `aidlc config`), each call asking first; 0.1.1's hand
  edit was unnecessary and made the next `aidlc config` stop. RE Step 1c tells the developer brief
  the same.
- **0.1.1** (2026-11-10): Step 1c names `get_space_overview` / `get_hyperspace_overview`, copies
  each generated document with its own commit and freshness, and copies the hyperspace overview.
- **0.1.0** (2026-11-10): first version, against AI-DLC 2.11.4-preview and CodeKB 1.6.0 (8754994).
