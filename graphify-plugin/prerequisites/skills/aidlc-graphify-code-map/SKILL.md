---
name: aidlc-graphify-code-map
description: >
  Analyse an existing codebase with an installed code-map tool and wire the result into this
  workspace so the AI-DLC brownfield stages reason from measured structure instead of a cold scan.
  Run this ONCE before `/aidlc <intent>`. Use it when the user has installed such a tool —
  Graphify is the one this skill knows — and wants to use it for AI-DLC but does not know how:
  "graphify 설치했는데 어떻게 써", "내 소스 분석해서 AI-DLC 에 쓰고 싶어", "graphify 로 분석하고 시작할래",
  "코드맵 만들어서 워크플로에 넣어", "브라운필드 분석 어디서 시작해", "코드맵 반영해",
  "코드맵 새로 돌렸다", "external code map 갱신",
  "I installed Graphify, how do I use it with AI-DLC". Also use it when someone asks where the
  code map reaches, why a stage did or did not see it, or whether it replaces `reverse-engineering`
  — it does not, and this skill says what does what.
  This skill does NOT install the tool and does NOT write the CodeKB store. It needs graphify-plugin
  composed into the workspace (its converter).
---

# Analyse the codebase, then wire it in — run before `/aidlc`

Four moves, per repo: pick the repos → make sure each has a current analysis (build it if not) →
carry each result into the workspace knowledge → hand back to `/aidlc`.

🔴 **This does not replace `reverse-engineering` (2.1).** That stage owns the CodeKB store and the
store is the only structural surface later stages consume. What this skill produces is *evidence*
the stage reads first — an index that says which files to open.

## Step 1 — decide what gets analysed

```bash
ls -d */ 2>/dev/null                  # sibling directories under the workspace root
git -C <candidate> rev-parse --show-toplevel 2>/dev/null   # is it its own repo?
```

AI-DLC registers sibling repos at intent birth and `reverse-engineering` scans each registered repo
on its own. So the things to analyse are the sibling repos holding application source — not the
workspace root (unless it is the only repo), and never `aidlc/` or a harness directory.

- **Each repo gets its own analysis**, run from inside that repo, into that repo's `graphify-out/`.
  The converter keeps one set of files per repo, named after the repo directory.
- **Ask which repos** when more than one candidate exists. Analysing a tree nobody will scan wastes
  the run.
- **Two repos with the same directory name** (in different parent folders) cannot both be converted
  into one workspace — their files would collide, and the converter refuses.

## Step 2 — is the tool installed?

The tool is the user's to install; this skill never installs it. It is a Python CLI, so check the
command rather than a config directory:

```bash
command -v graphify && graphify --help >/dev/null 2>&1 && echo installed
ls -d */graphify-out 2>/dev/null       # an existing analysis, per repo
```

If it is missing, say so plainly and **stop** — there is nothing useful to do until it is installed.
Installing it is the user's move, and one line is enough:

```
Read the README at https://github.com/Graphify-Labs/graphify and install Graphify with
`uv tool install "graphifyy[pdf,office,mcp]"`. Install it for my user, not inside this workspace.
```

⭐ The PyPI package is `graphifyy` (two y's) while the command is `graphify` — a mismatch worth
naming, because `uv tool install graphify` installs something else. The extras are what add PDF,
Office and MCP support; the base install parses code only.

⚠️ **Do not run `graphify kiro install` or `graphify claude install`.** Those write an always-on
instruction into the harness — on Kiro, `.kiro/steering/graphify.md`, which Kiro loads unscoped for
every stage, and on Claude Code a `PreToolUse` hook that intercepts `Read`/`Grep`. This workspace
already carries that wiring through channels AI-DLC governs, and a second uncontrolled one competes
with the stage protocol's own reading discipline.

## Step 3 — decide build vs reuse

| what you find | do |
|---|---|
| no `graphify-out/`, or a `cache/` but no `graph.json` | build (Step 4) |
| `graph.json` exists and no source file changed since | reuse — skip to Step 5 and say the map was already current |
| `graph.json` exists and sources moved | rebuild (Step 4) — it is cheap, see below |

**Freshness here is content-based, not commit-based.** The tool keys its cache on a SHA256 of each
file's contents (`graphify-out/cache/`), and it omits the commit field entirely outside a git
repository rather than writing an empty one. So:

- **A non-git source tree is a supported setup, not a degraded one.** Do not report a freshness
  problem you cannot establish; say that freshness rests on content hashes.
- **When in doubt, rebuild.** A code-only rebuild costs **no API calls at all** and ran in ~2.5s on a
  123-file Java + TypeScript corpus (measured). There is no reason to reason about staleness when
  re-measuring is cheaper than the reasoning.

## Step 4 — build the map

**Settle the exclusions with the user first.** This is the one input that decides whether two runs
are comparable, and it is a project decision, not yours to guess. Start from the stack and confirm:

| stack | start from |
|---|---|
| Gradle/Maven + JS | `.gradle/,build/,target/,**/node_modules/,**/dist/,graphify-out/` |
| Node/TS | `node_modules/,dist/,build/,coverage/,.next/,graphify-out/` |
| Python | `.venv/,__pycache__/,*.egg-info/,dist/,graphify-out/` |
| Go/Rust | `target/,vendor/,bin/,graphify-out/` |

Then, from inside the analysed repo:

```bash
graphify update .          # AST-only rebuild, no LLM, no API calls
```

Five rules that decide whether the result is trustworthy:

1. **Exclusions go in `.graphifyignore` at the analysed root**, because `graphify update` takes no
   `--exclude`. The tool reads `.gitignore` too — as a pattern file, so it works without git — but
   ⚠️ **a tree with no `.gitignore` gets no protection from it**: measured on such a tree, the
   generated ignore file had **zero active patterns** and `node_modules` (≈8,700 files) was held out
   only by the explicit exclusions.
2. **Exclude the tool's own output directory**, or the next build ingests its own graph as source.
   🔴 **And add `graphify-out/` to the analysed repo's `.gitignore` while you are there.** Two different
   consumers need it out: the next build (rule above) and **AI-DLC's own source scan** — the source
   identity's exclusion lists cover dependency trees (`node_modules`, `.venv`, …) and conventional
   generated names (`build`, `dist`, `target`, …), and `graphify-out` is in neither, so nothing removes it
   automatically. Measured on a real tree: 4.2 MB / 85 files including a 1.3 MB `graph.json`, an HTML view
   and a markdown report — all of it readable as if it were source. Say in your Step 6 report whether the
   `.gitignore` line is present.
3. **Never exclude tests** — the `tested_by` relations and the test-topology view come from there.
4. **Community names cost an LLM pass and are skipped by default.** `graphify update` leaves
   communities numbered. If a human will read the architect slice, buy the names with one
   `graphify cluster-only . --backend <name>`; if only agents read it, leave them numbered and let
   the converter present representative nodes instead. Say which you did.
5. **Prose, PDFs and diagrams are a separate pass and the only one that spends tokens.** The code
   pass is deterministic. If the corpus has documents worth ingesting, run that pass deliberately and
   report it separately — do not let it hide inside "I built the map".

⚠️ **Check what the build actually collected before you trust it.** The output carries no
`project` block, so it will not tell you the project's name or language set; read the node count,
the community count and the `file_type` spread instead, and confirm nothing under an excluded path
got in.

## Step 5 — wire the result in

```bash
bun --version                                                   # the converter runs on Bun
bun <harness-dir>/tools/graphify-map.ts <repo-a> [<repo-b> ...] --workspace . --space <active-space>
```

`<harness-dir>` is `.kiro`, `.claude` or `.codex`, whichever holds `aidlc-common/`. graphify-plugin installed
the converter there; if `<harness-dir>/tools/graphify-map.ts` is missing, the plugin is not composed
— say so and stop. `<active-space>` is the space named in `aidlc/active-space`; the converter writes
to `default` when `--space` is omitted, so always pass it. When `bun --version` fails, tell the user
to install Bun (https://bun.sh) — a native AI-DLC install does not include it.

Idempotent — run it again after every rebuild. Converting one repo leaves the other repos' files
alone. It prints each file with its byte size and whether it changed. What it writes per repo and who
reads it:

| file | read by |
|---|---|
| `aidlc/spaces/<space>/knowledge/aidlc-shared/graphify-code-map.<repo>.md` | every agent — provenance, freshness, stack, areas, pointers |
| `.../knowledge/aidlc-architect-agent/graphify-architecture.<repo>.md` | the architect — community structure, cross-community seams |
| `.../knowledge/aidlc-developer-agent/graphify-structure.<repo>.md` | the developer — hub nodes, relations, hot files, edges to confirm |
| `.../knowledge/aidlc-product-agent/graphify-documents.<repo>.md` | the product agent — **only when the map has non-code nodes** |

The last one is conditional on evidence, not configuration: the code pass emits `file_type: code`
only, so that file appears once documents have been ingested and not before.

**Inline and mob stages read every path in their inline roster as their first tool calls**, so
anything in `aidlc-shared/` is paid by ~30 stages per run — that is why the bulk sits with the owning
agent. Delegated stages get no inline roster, but the stock persona carries a
`<!-- aidlc-delegated-knowledge-preflight -->` sentinel whose paragraph mandates loading
`aidlc-shared/` and its own agent directory, so they are covered too. Anchor on that sentinel rather
than on a heading title — the heading that used to carry this was renamed.

⚠️ If the script reports **`no such agent in this workspace`** it exits non-zero and skips that
slice — this distribution's persona roster differs. Read `<harness>/agents/` for the real names and
fix the mapping rather than leaving a file nobody reads.

## Step 6 — hand back

Report, in three lines **per repo**: which repo was analysed and what its `freshness` row says;
whether the map was built now or reused, and whether community naming ran; which knowledge files
exist for it and their sizes. Name any fixed-name files the converter listed as left over from an
older version. Then tell the user the next move:

> Ready. Start the workflow with `/aidlc <what you want to build>` — the brownfield stages will pick
> the code map up as evidence, and `reverse-engineering` will still produce the CodeKB store.

## Never

- ❌ **Never hand-write the CodeKB store** (`aidlc/spaces/<space>/codekb/<repo>/`). Its freshness
  fingerprint is minted by the tooling; a hand-written one fails verification next run and costs the
  reuse option. Ask for the path — `codekb-path --repo <repo>` — instead of assembling it.
- ❌ **Never pass a code map to `/aidlc compose --report`.** That entry point expects a findings
  report and answers with a fix-and-ship grid; structural analysis there distorts feature work into
  a bugfix shape.
- ❌ **Never present the map as truth.** Confirm each claim against the source file and cite that
  file, not the map. Where the map tags an edge `EXTRACTED` the source citation already exists;
  spend the confirmation on `INFERRED` and `AMBIGUOUS`.
- ❌ **Never read a community number as a designed module**, and never invent a name for one.

## Freshness afterwards

Rebuild rather than reasoning about staleness — it is free and takes seconds. The tool also ships
git hooks (`graphify hook install`) that rebuild on commit and on checkout, and a merge driver that
union-merges `graph.json` so it never conflicts; both are opt-in and both need git. Where they are
not installed, the check is manual and Step 3 is how you do it.
