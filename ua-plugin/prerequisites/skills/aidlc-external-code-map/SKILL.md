---
name: aidlc-external-code-map
description: >
  Analyse an existing codebase — one repo or several sibling repos — with Understand-Anything and
  wire each result into this workspace so the AI-DLC brownfield stages reason from measured
  structure instead of a cold scan. Run this before `/aidlc <intent>`, and again after a repo moves.
  Use it when the user has installed Understand-Anything and wants to use it for AI-DLC but does not
  know how: "understand anything 설치했는데 어떻게 써", "내 소스 분석해서 AI-DLC 에 쓰고 싶어",
  "UA 로 분석하고 시작할래", "코드맵 만들어서 워크플로에 넣어", "repo 두 개 다 분석해서 넣어",
  "브라운필드 분석 어디서 시작해", "understand 어떻게 돌려", "코드맵 반영해", "코드맵 새로 돌렸다",
  "external code map 갱신", "I installed Understand-Anything, how do I use it with AI-DLC". Also use
  it when someone asks where the code map reaches, why a stage did or did not see it, or whether it
  replaces `reverse-engineering` — it does not. This skill does NOT install the tool and does NOT
  write the CodeKB store. It needs ua-plugin composed into the workspace (its converter).
---

# Analyse each repo, then wire it in — run before `/aidlc`

Four moves, per repo: pick the repos → make sure each has a current analysis (run it if not) → carry
each result into the workspace knowledge → hand back to `/aidlc`.

🔴 **This does not replace `reverse-engineering`.** That stage owns the CodeKB store and the store is
the only structural surface later stages consume. What this skill produces is *evidence* the stage
reads first — an index that says which files to open.

## Step 1 — decide what gets analysed

```bash
ls -d */ 2>/dev/null                                        # sibling directories under the workspace root
git -C <candidate> rev-parse --show-toplevel 2>/dev/null    # is it its own repo?
```

AI-DLC registers sibling repos at intent birth and `reverse-engineering` scans each registered repo
on its own. So the things to analyse are the sibling repos holding application source — not the
workspace root (unless it is the only repo), and never `aidlc/` or a harness directory.

- **Each repo gets its own analysis**, run from inside that repo, into that repo's `.ua/`. Never
  analyse the workspace root to cover several repos at once: the map would not match the per-repo
  scans, and its paths would not resolve inside any one repo.
- **Ask which repos** when more than one candidate exists. Analysing a tree nobody will scan wastes
  the run.
- **Two repos with the same directory name cannot both be converted** into one workspace: the
  converter names files by repo directory name.

## Step 2 — is the tool installed?

The tool is the user's to install; this skill never installs it.

```bash
ls -d */.ua 2>/dev/null                                             # existing analyses, per repo
ls -d ~/.understand-anything ~/.*/skills/understand* 2>/dev/null    # in $HOME — the documented route
ls -d .*/skills/understand* .*/agents/understand* 2>/dev/null       # inside the workspace, if placed there
```

🔴 **Check the `$HOME` paths first.** The documented install writes to `$HOME`, so a probe that only
looks inside the workspace reports "not installed" for a good install. On some harnesses the
registration is not a file at all — if these come back empty, ask whether the tool's commands are
available before concluding it is missing.

If nothing is found, say so plainly and **stop**. Installing it is the user's move:

```
Read the README at https://github.com/Egonex-AI/Understand-Anything and install Understand-Anything. Install it in my home directory, not inside this workspace.
```

## Step 3 — analyse or reuse, per repo

| what you find in `<repo>/.ua/` | do |
|---|---|
| nothing, or intermediates but no `knowledge-graph.json` | analyse (Step 4) |
| `meta.json` commit **≠** `git -C <repo> rev-parse HEAD` | stale → re-analyse (incremental) |
| commit matches | reuse — go to Step 5 and say the map was already current |
| the repo is **not a git checkout** | freshness cannot be decided from a commit — say so and offer a re-run; never take a hash from another checkout |
| a **workspace map** at the root (`.ua/` over several repos, paths `<repo>/...`) | compare each repo's HEAD with `.ua/repo-heads.json`; no such file → freshness unknown. After a (re-)analysis at the root, write it: `bun <harness>/tools/ua-code-map.ts --record-heads .` |

## Step 4 — run the analysis (inside the repo)

**First settle the exclusions with the user** — the one input that decides whether two runs are
comparable. Start from the stack and confirm:

| stack | start from |
|---|---|
| Gradle/Maven + JS | `.gradle/,build/,target/,**/node_modules/,**/dist/,gradle/wrapper/*.jar,.ua/` |
| Node/TS | `node_modules/,dist/,build/,coverage/,.next/,.ua/` |
| Python | `.venv/,__pycache__/,*.egg-info/,dist/,.ua/` |
| Go/Rust | `target/,vendor/,bin/,.ua/` |

```
/understand . --language <ISO 639-1> --review --exclude '<the confirmed list>'
/understand-domain
```

Rules that decide whether the result is trustworthy (measured on real runs):

1. **Pass exclusions as `--exclude`**, never by hand-editing the tool's ignore file. A newly added
   pattern only takes effect on a full scan, so add `--full` when exclusions change.
2. **Name the language explicitly** — the tool defaults to English.
3. **Keep the tool's own data out of the scan.** The project scanner does not drop `.ua/` by default
   (`scan-project.mjs --exclude-analysis-data` does; the incremental path adds it itself).
4. 🔴 **Make git ignore `.ua/` in each analysed repo before the workflow starts** — in its
   `.gitignore`, or with no commit in `.git/info/exclude` (`git -C <repo> check-ignore -q .ua/` checks
   either). AI-DLC's source scan follows git's ignore rules and does not exclude `.ua/` otherwise, and
   editing `.gitignore` during `reverse-engineering` changes the source fingerprint — under a strict
   policy CodeKB publishing then fails with `CODEKB_SOURCE_CHANGED`.
5. **Start with the full scope.** Starting narrow and widening later trips the tool's "more than 30
   files and more than 50% of the project" rule and becomes a full re-analysis anyway.
6. **Fix the node ID scheme before the first batch** when the structural extractor has nothing to
   offer (SQL and other languages without a grammar: the import map and structure come back empty).
   Without it every batch invents its own IDs. A scheme that worked: `file:<path>`,
   `function:<path>:<ROUTINE>`, `calls` between functions only, no table nodes. Changing it midway
   means rewriting the finished batches.
7. **Tell the analysers about mixed encodings** (e.g. CP949 or UTF-16LE files: `iconv -f <enc> -t
   UTF-8`). A file read as garbage is summarised as garbage.
8. **When one repo calls into another, tag the calling nodes** `<prefix>:<NAME>` (for example
   `<other-repo>-routine:<NAME>` for a procedure the other repo defines). The converter lists tag
   prefixes and their counts, and the agents can follow them across repos. Write what each prefix
   means in the run's guide (rule 11).
9. **Never exclude tests**, and **run the domain pass after the graph and without `--full`**, so
   both layers rest on one graph.
10. **Name this stack's non-import reference kinds when the review runs** — same-package references,
    DI and string-keyed lookups, framework conventions, build-time wiring. The dependency map is
    built from imports, so those are absent by construction. Treat the edge count as a floor.
11. **Keep any onboarding guide or analysis notes inside `<repo>/.ua/`.** The converter lists the
    top-level `.md` files there by path, so agents can find them; it does not copy them into the
    knowledge overlay.
12. **Check the metadata the run wrote before converting.** `gitCommitHash` in `meta.json` and
    `knowledge-graph.json` must be the repo's commit (or `""` on a tree with no `.git` — `null` makes
    the tool's own dashboard refuse the graph). Subagents have been seen changing it on the strength
    of an outdated project instruction, so compare it with `git rev-parse HEAD`.
13. **When the project's instructions gate access** (an approval line in `CLAUDE.md`/`AGENTS.md`),
    put the approval there and **start a new session** before the run. Analysis subagents read the
    instructions as they were when the session started, and a message from another session does not
    lift a refusal.
14. **On a very large repo** (thousands of files), the merge-review, layer and tour phases may not
    fit. If you replace them with deterministic checks and package-level summaries, write the method
    and its limits into the run's guide — later readers need to know which parts were judged by a
    model and which were counted.

⚠️ **Not every harness can dispatch the tool's analysis sub-agents.** Where it cannot, run the tool's
deterministic scripts directly and do the reasoning steps yourself, and say which path you took.

## Step 5 — wire each result in

ua-plugin installs the converter into the harness tools. One call can take several repos:

```bash
bun <harness-dir>/tools/ua-code-map.ts <repo-a> [<repo-b> ...] --workspace . --space <active-space>
```

🔴 **When the workspace root holds a merged map** (`.ua/meta.json` at the root has `mergedFrom`), convert
the root only — `bun <harness-dir>/tools/ua-code-map.ts . --workspace . --space <active-space>` — and do
not pass the repos one by one. The root conversion writes the same per-repo file names with the edges
across repos added; converting a repo's own map afterwards overwrites them and loses those edges.

Idempotent — run it again after every re-analysis; it rewrites only the repo you pass. Each repo
gets its own set of files, named after it:

| file | read by |
|---|---|
| `aidlc/spaces/<space>/knowledge/aidlc-shared/ua-code-map.<repo>.md` | every agent — provenance, freshness, stack, layer names, tour titles, guides, pointers |
| `.../knowledge/aidlc-architect-agent/ua-architecture.<repo>.md` | the architect — layer descriptions, node census |
| `.../knowledge/aidlc-developer-agent/ua-structure.<repo>.md` | the developer — hot files, relations, tag prefixes, fan-out, the full tour |
| `.../knowledge/aidlc-product-agent/ua-domains.<repo>.md` | the product agent — domains in full, flows listed |

- If it names files from the single-repo converter (`ua-code-map.md` and friends, no repo in the
  name), every agent still loads them: delete them once the per-repo files exist.
- If it reports **`no such agent in this workspace`**, it exits 1 and skips that slice — read
  `<harness>/agents/` for the real names rather than leaving a file nobody reads.
- An owner-only map produces owner-only knowledge files.

## Step 6 — hand back

Report per repo, one line each: which commit was analysed, whether the analysis was run now or
reused, whether git ignores its `.ua/`, and the knowledge files with their sizes. Then:

> Ready. Start the workflow with `/aidlc <what you want to build>` — `reverse-engineering` will use
> each repo's map as an index and still produce the CodeKB store for each repo.

## Never

- ❌ **Never hand-write the CodeKB store** (`aidlc/spaces/<space>/codekb/<repo>/`). Its freshness
  fingerprint is minted by the tooling; a hand-written one fails verification.
- ❌ **Never pass a code map to `/aidlc compose --report`.** That entry point expects a findings
  report and answers with a fix-and-ship grid.
- ❌ **Never present the map as truth.** It is a snapshot of one commit: confirm each claim against
  the source file and cite that file, not the map.
- ❌ **Never put a generated onboarding document into the knowledge overlay.** Every stage would
  re-read it. Leave it in `<repo>/.ua/`, where the converter lists it.
