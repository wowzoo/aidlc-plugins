#!/usr/bin/env bun
/**
 * Turn external code maps (Understand-Anything's `<repo>/.ua/`) into the workspace's knowledge
 * overlay, one set of files per repo, split per agent.
 *
 * WHY PER REPO: a workspace may hold several sibling repos, and reverse-engineering scans each one
 * on its own (possibly as parallel subagents). Every file this script writes carries the repo name
 * in its file name and in its first heading, so converting one repo never overwrites another's map,
 * and an agent working on one repo can tell which files describe it.
 *
 * WHY SPLIT: inline and mob stages are handed `inline_context_paths` and the protocol makes the
 * agent read EVERY path as its first tool calls. Anything in `aidlc-shared/` is therefore paid by
 * ~30 stages on every run. So the shared file carries orientation plus pointers, and the bulky
 * slices sit with the agent that owns them. No content is duplicated.
 *
 *   aidlc-shared/ua-code-map.<repo>.md                provenance, freshness, stack, layer names,
 *                                                     tour titles, guides, pointers
 *   aidlc-architect-agent/ua-architecture.<repo>.md   layer descriptions, node census
 *   aidlc-developer-agent/ua-structure.<repo>.md      hot files, edge census, tag prefixes,
 *                                                     import fan-out, full tour
 *   aidlc-product-agent/ua-domains.<repo>.md          domains in full, flows as a list (steps excluded)
 *
 * Delegated stages (subagent/pipeline) get no inline roster, but the stock persona carries a
 * `<!-- aidlc-delegated-knowledge-preflight -->` sentinel whose paragraph mandates loading the
 * shell's `knowledge/{aidlc-shared,<agent>}/` and then `aidlc/spaces/<space>/knowledge/
 * {aidlc-shared,<agent>}/` — so they are covered too.
 *
 * The rules for USING a code map live in `aidlc-shared/external-code-map.md`, which this plugin
 * ships; the files this script writes carry provenance and facts only.
 *
 * Schema source of truth: Understand-Anything `packages/core/src/types.ts` — `KnowledgeGraph`
 * {version, kind?, project{name,languages,frameworks,description,analyzedAt,gitCommitHash},
 *  nodes[{id,type,name,filePath?,summary,tags,complexity,domainMeta?}], edges[{source,target,type,
 *  weight}], layers[{id,name,description,nodeIds}], tour[{order,title,description,nodeIds}]} and
 * `DomainMeta` {entities?, businessRules?, crossDomainInteractions?, entryPoint?, entryType?}.
 * `.ua/meta.json` {lastAnalyzedAt, gitCommitHash, version, analyzedFiles} (measured, 2.9.7).
 *
 * WORKSPACE MAP: a map may also be built ONCE over a folder that holds several repos as child
 * directories (`<root>/.ua/`, node paths `<repo>/src/...`). Given such a root, the converter splits the
 * one graph by the first path segment and writes the same per-repo set for every repo it finds, so a
 * stage that briefs per repo needs nothing new. Each repo's structure slice also counts the edges that
 * cross into other repos — the part a per-repo map cannot see. A root that is not a git checkout has
 * no commit to anchor freshness to, so `--record-heads <root>` writes `<root>/.ua/repo-heads.json`
 * ({repo: HEAD}) right after the analysis, and the converter compares each repo's HEAD against it.
 *
 * Usage:
 *   bun <harness>/tools/ua-code-map.ts <analyzed-repo-or-map-root> [...] --workspace <ws> [--space default]
 *   bun <harness>/tools/ua-code-map.ts <analyzed-repo-or-map-root> --dry-run
 *   bun <harness>/tools/ua-code-map.ts --record-heads <map-root>
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const KNOWLEDGE = (space: string, owner: string, name: string) =>
  `aidlc/spaces/${space}/knowledge/${owner}/${name}`;
const SHARED = ["aidlc-shared", "ua-code-map"] as const;
const ARCHITECT = ["aidlc-architect-agent", "ua-architecture"] as const;
const DEVELOPER = ["aidlc-developer-agent", "ua-structure"] as const;
const PRODUCT = ["aidlc-product-agent", "ua-domains"] as const;
const OWNERS = [SHARED, ARCHITECT, DEVELOPER, PRODUCT];

/** The file a slice lands in for one repo. The repo name sits between the kind and `.md`, so names
 * of repos that share a prefix (`app`, `app-web`) can never collide. */
const fileName = (kind: string, repo: string) => `${kind}.${repo}.md`;

const USE_RULES =
  "Rules for using this: `aidlc-shared/external-code-map.md`, which every agent loads with its knowledge.";
const SNAPSHOT =
  "⚠️ A snapshot. Confirm anything you use against the source file, and cite that file — not this one.";
const HEADING = "# External code map — ";

type Dict = Record<string, unknown>;

function load(path: string): Dict | null {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Dict;
  } catch {
    return null;
  }
}

/** The workspace's real agent names, or null when none can be found.
 *
 * Writing a slice into an agent directory that does not exist produces a path nobody reads — a
 * silent failure. `<ws>/<harness>/agents/*.md` is the same place on every harness, so read the
 * names and compare. */
function roster(workspace: string): Set<string> | null {
  let dots: string[];
  try {
    dots = readdirSync(workspace, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name.startsWith("."))
      .map((e) => e.name)
      .sort();
  } catch {
    return null;
  }
  for (const d of dots) {
    const dir = join(workspace, d, "agents");
    if (!existsSync(dir)) continue;
    const names = readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.slice(0, -3));
    if (names.length > 0) return new Set(names);
  }
  return null;
}

const arr = (v: unknown): Dict[] => (Array.isArray(v) ? (v as Dict[]) : []);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const strs = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);

/** Counts in first-seen order, then sorted by count descending. Array#sort is stable, so ties keep
 * insertion order. */
function tally(values: string[]): [string, number][] {
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function table(rows: [string, string][], head: [string, string]): string[] {
  return [`| ${head[0]} | ${head[1]} |`, "|---|---|", ...rows.map(([a, b]) => `| ${a} | ${b} |`)];
}

const head = (repo: string, kind: string): string[] => [`${HEADING}\`${repo}\` · ${kind}`, ""];

// --- provenance -------------------------------------------------------------

/** The analysed tree's current HEAD, or null when it is not a git checkout or git is unavailable. */
function headCommit(repoDir: string): string | null {
  if (!existsSync(join(repoDir, ".git"))) return null;
  const r = spawnSync("git", ["-C", repoDir, "rev-parse", "HEAD"], { encoding: "utf-8" });
  if (r.status !== 0) return null;
  const out = r.stdout.trim();
  return /^[0-9a-f]{7,64}$/.test(out) ? out : null;
}

/** The provenance row for the commit the map came from.
 *
 * None of the outcomes may render as a bare empty value. Observed in practice: a tree with no
 * `.git` produced `gitCommitHash: ""` and the row rendered as an empty pair of backticks — a blank
 * where provenance belongs, with nothing saying why. Worse, a run whose hash came from a DIFFERENT
 * checkout of the same sources wrote a real-looking hash that cannot be resolved in the tree that
 * was analysed. Both mislead, so both are labelled here. */
function commitRow(repoDir: string, hash: string): string {
  const isCheckout = existsSync(join(repoDir, ".git"));
  if (hash === "") {
    return isCheckout
      ? "not recorded by the tool (the tree IS a git checkout — treat as a tooling gap)"
      : "not recorded — the analysed tree is not a git checkout, so freshness is not anchored to a commit";
  }
  return isCheckout
    ? `\`${hash}\``
    : `\`${hash}\` ⚠️ **unverifiable** — the analysed tree has no \`.git\`, so this hash came from elsewhere`;
}

/** Whether the map's commit is still the tree's HEAD, as measured at conversion time. A prefix
 * match counts: the tool may record a short hash. */
function freshnessRow(hash: string, head: string | null): string {
  if (hash === "") return "unknown — the map records no commit";
  if (head === null) return "unknown — no git HEAD could be read in the analysed tree";
  const same = head.startsWith(hash) || hash.startsWith(head);
  return same
    ? `map commit is HEAD (\`${head.slice(0, 12)}\`) at conversion time`
    : `🔴 **stale** — HEAD is \`${head.slice(0, 12)}\`; files changed since the map's commit are not mapped`;
}

/** Top-level Markdown files the map run left in `.ua/` (an onboarding guide, analysis notes). They
 * are listed by path and size only; this script does not copy or summarise them. */
function guides(ua: string): [string, number][] {
  try {
    return readdirSync(ua, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".md"))
      .map((e) => [e.name, statSync(join(ua, e.name)).size] as [string, number])
      .sort((a, b) => a[0].localeCompare(b[0]));
  } catch {
    return [];
  }
}

// --- shared slice -----------------------------------------------------------

type WsInfo = { root: string; share: string; recorded: string | null };

function sharedSlice(
  repo: string,
  repoDir: string,
  g: Dict | null,
  s: Dict | null,
  meta: Dict | null,
  docs: [string, number][],
  extra: [string, string][],
  ws: WsInfo | null = null,
): string[] {
  const L = head(repo, "orientation");
  let langs: string[] = [];
  let fws: string[] = [];
  const uaRel = ws ? ".ua" : `${repo}/.ua`;
  if (g) {
    const p = (g.project as Dict) ?? {};
    const hash = ws ? (ws.recorded ?? "") : str(p.gitCommitHash) || str(meta?.gitCommitHash);
    const rows: [string, string][] = ws
      ? [
          ["source", `\`.ua/knowledge-graph.json\` at \`${ws.root}\` — one **workspace map** over several repos; this file covers \`${repo}/\` (${ws.share})`],
          ["analyzed at", String(p.analyzedAt ?? meta?.lastAnalyzedAt ?? "?")],
          [
            "git commit",
            ws.recorded
              ? `\`${ws.recorded}\` (recorded in \`.ua/${HEADS_FILE}\`)`
              : `not recorded — the map root is not a git checkout and \`.ua/${HEADS_FILE}\` has no entry for \`${repo}\``,
          ],
          ["freshness", freshnessRow(hash, headCommit(repoDir))],
          ["nodes / edges / layers (this repo)", `${arr(g.nodes).length} / ${arr(g.edges).length} / ${arr(g.layers).length}`],
        ]
      : [
          ["source", `\`${repo}/.ua/knowledge-graph.json\` (complete)`],
          ["analyzed at", String(p.analyzedAt ?? meta?.lastAnalyzedAt ?? "?")],
          ["git commit", commitRow(repoDir, hash)],
          ["freshness", freshnessRow(hash, headCommit(repoDir))],
          ["nodes / edges / layers", `${arr(g.nodes).length} / ${arr(g.edges).length} / ${arr(g.layers).length}`],
        ];
    if (typeof meta?.analyzedFiles === "number") rows.push(["files analyzed", String(meta.analyzedFiles)]);
    L.push(...table(rows, ["provenance", "value"]));
    langs = strs(p.languages);
    fws = strs(p.frameworks);
  } else {
    const st = s ?? {};
    L.push(
      ...table(
        [
          ["source", `\`${uaRel}/intermediate/scan-result.json\` (**scan only**)`],
          ["files scanned", String(st.totalFiles ?? arr(st.files).length)],
          ["estimated complexity", String(st.estimatedComplexity ?? "?")],
        ],
        ["provenance", "value"],
      ),
    );
    L.push(
      "",
      "🔴 **The analysis is incomplete** — `knowledge-graph.json` does not exist yet, so",
      "there are no nodes, layers, or relationship edges anywhere in this set.",
    );
    langs = strs(st.languages);
    fws = strs(st.frameworks);
  }

  L.push("", SNAPSHOT, USE_RULES, "");
  if (langs.length || fws.length) {
    L.push("## Stack (measured by the tool)", "");
    if (langs.length) L.push(`- languages: ${langs.map((x) => `\`${x}\``).join(", ")}`);
    if (fws.length) L.push(`- frameworks: ${fws.map((x) => `\`${x}\``).join(", ")}`);
    L.push("");
  }

  const layers = arr(g?.layers);
  if (layers.length) {
    L.push("## Layers (names and sizes only)", "");
    L.push(
      ...table(
        layers.map((l) => [`**${str(l.name) || "?"}**`, `${strs(l.nodeIds).length} nodes`] as [string, string]),
        ["layer", "size"],
      ),
    );
    L.push("", "Layer descriptions are in the architect slice below.", "");
  }

  const tour = arr(g?.tour);
  if (tour.length) {
    L.push(
      "## Guided tour (titles only)",
      "",
      "The tool built a walkthrough. Titles here so you know the shape; the step text is in",
      "the developer slice below (and in `knowledge-graph.json` under `tour[]`).",
      "",
    );
    tour.forEach((st2, i) => L.push(`${st2.order ?? i + 1}. ${str(st2.title) || "?"}`));
    L.push("");
  }

  if (docs.length) {
    L.push(
      "## Guides left by the map run",
      "",
      "Prose files in the map's data directory, listed by path only. They were written during the",
      "analysis, so the same rules apply: read the one you need, confirm in the source, cite the source.",
      "",
    );
    L.push(...table(docs.map(([f, n]) => [`\`${uaRel}/${f}\``, `${n} B`] as [string, string]), ["path", "size"]));
    L.push("");
  }

  if (extra.length) {
    L.push(
      "## Deeper slices — read the one you need",
      "",
      "Each is loaded automatically for the agent that owns it; any agent may read the",
      "others by path.",
      "",
    );
    L.push(...table(extra.map(([p, why]) => [`\`${p}\``, why] as [string, string]), ["path", "holds"]));
    L.push("");
  }
  return L;
}

// --- agent slices -----------------------------------------------------------

function architectSlice(repo: string, g: Dict): string[] {
  const layers = arr(g.layers);
  const nodes = arr(g.nodes);
  if (!layers.length && !nodes.length) return [];
  const L = [...head(repo, "architecture"), SNAPSHOT, USE_RULES, ""];
  if (layers.length) {
    L.push("## Layers", "");
    for (const l of layers) {
      L.push(`### ${str(l.name) || "?"}  (${strs(l.nodeIds).length} nodes)`, "");
      if (str(l.description)) L.push(str(l.description), "");
    }
  }
  if (nodes.length) {
    const kinds = tally(nodes.map((n) => str(n.type) || "?"));
    const cx = tally(nodes.map((n) => str(n.complexity) || "?"));
    L.push("## Node census", "");
    L.push(...table(kinds.map(([k, v]) => [`\`${k}\``, String(v)] as [string, string]), ["node type", "count"]));
    L.push("", "complexity: " + cx.map(([k, v]) => `${k}=${v}`).join(" · "), "");
  }
  return L;
}

function developerSlice(repo: string, g: Dict | null, s: Dict | null, cross: [string, number][] = []): string[] {
  const nodes = arr(g?.nodes);
  const edges = arr(g?.edges);
  const imports = ((s?.importMap as Dict) ?? {}) as Record<string, unknown>;
  const files = tally(nodes.filter((n) => str(n.filePath)).map((n) => str(n.filePath)));
  const importKeys = Object.keys(imports);
  if (!files.length && !edges.length && !importKeys.length && !cross.length) return [];
  const L = [...head(repo, "structure"), SNAPSHOT, USE_RULES, ""];
  if (files.length) {
    L.push("## Files carrying the most nodes", "");
    L.push(
      ...table(files.slice(0, 20).map(([f, c]) => [`\`${f}\``, String(c)] as [string, string]), ["file", "nodes"]),
    );
    L.push("");
  }
  if (edges.length) {
    const et = tally(edges.map((e) => str(e.type) || "?"));
    L.push("## Relationship census", "");
    L.push(...table(et.map(([k, v]) => [`\`${k}\``, String(v)] as [string, string]), ["edge type", "count"]));
    L.push("");
  }
  if (cross.length) {
    L.push(
      "## Edges across repos (workspace map)",
      "",
      "Edges between a node in this repo and a node in another repo of the same map. `→` leaves this",
      "repo, `←` comes in. Find the endpoints in `knowledge-graph.json`, confirm both sides in the source.",
      "",
    );
    L.push(...table(cross.slice(0, 30).map(([k, v]) => [k, String(v)] as [string, string]), ["direction · other repo · edge type", "count"]));
    L.push("");
  }
  // Tags of the form `<prefix>:<value>` are labels the analysis run attached on purpose (for example
  // the name of a routine a mapper calls). Only the prefixes and their counts go here: what a prefix
  // means is whatever that run recorded, so read the run's guide before relying on one.
  const prefixed = tally(
    nodes.flatMap((n) =>
      strs(n.tags)
        .filter((t) => typeof t === "string" && /^[^:\s]+:\S/.test(t))
        .map((t) => t.slice(0, t.indexOf(":"))),
    ),
  );
  if (prefixed.length) {
    L.push(
      "## Tag prefixes (`<prefix>:<value>` tags on nodes)",
      "",
      "Labels the analysis run attached. Search `knowledge-graph.json` for a prefix to list the nodes",
      "carrying it; the run's guide (see the orientation file) says what each prefix means.",
      "",
    );
    L.push(
      ...table(prefixed.slice(0, 20).map(([k, v]) => [`\`${k}:\``, String(v)] as [string, string]), ["prefix", "tags"]),
    );
    L.push("");
  }
  if (importKeys.length) {
    const fan: [string, number][] = importKeys
      .map((f) => [f, arr(imports[f]).length] as [string, number])
      .filter(([, c]) => c > 0)
      .sort((a, b) => b[1] - a[1]);
    if (fan.length) {
      L.push("## Import fan-out (from the scan's importMap)", "");
      L.push(
        ...table(fan.slice(0, 20).map(([f, c]) => [`\`${f}\``, String(c)] as [string, string]), ["file", "imports"]),
      );
      L.push("");
    }
  }
  const tour = arr(g?.tour);
  if (tour.length) {
    L.push(
      "## Guided tour",
      "",
      "The tool's own walkthrough of this codebase, in order. Treat each step as a claim to",
      "verify in the files it names.",
      "",
    );
    for (const st2 of tour) {
      const names = strs(st2.nodeIds).slice(0, 6).map((n) => `\`${n}\``).join(", ");
      L.push(`### ${st2.order ?? "?"}. ${str(st2.title) || "?"}`, "");
      if (str(st2.description)) L.push(str(st2.description), "");
      if (names) L.push(`nodes: ${names}`, "");
    }
  }
  return L;
}

/** A flow's summary cut to its first sentence, and to FLOW_SUMMARY_MAX characters as a guard, so a
 * summary with no sentence break cannot turn the flow list into prose. Measured on a 59-flow Korean
 * map: rows average ~420 bytes and none reached the cap, so the list costs ~25 KB at that size. A cut
 * is marked with "…"; the full text is in `domain-graph.json`. Table pipes are escaped so a summary
 * cannot break the row. */
const FLOW_SUMMARY_MAX = 160;
function firstSentence(s: string): string {
  const one = s.split(/(?<=[.!?。])\s/)[0].trim().replace(/\s+/g, " ");
  const cut = one.length > FLOW_SUMMARY_MAX ? `${one.slice(0, FLOW_SUMMARY_MAX).trimEnd()}…` : one;
  return cut.replace(/\|/g, "\\|");
}

/** `/understand-domain` output. Nodes are three tiers — `domain` > `flow` > `step` (measured).
 *
 * Only `domain` goes in full and `flow` as a list; `step` is left out. Steps are implementation
 * detail rather than business-overview material, and that tier is half the slice. The count that
 * was left out and the path to read it are printed in the file so nothing is silently truncated. */
function productSlice(repo: string, dg: Dict, graphPath = `${repo}/.ua/domain-graph.json`): string[] {
  const nodes = arr(dg.nodes);
  const domains = nodes.filter((n) => str(n.type) === "domain");
  const flows = nodes.filter((n) => str(n.type) === "flow");
  const steps = nodes.filter((n) => str(n.type) === "step");
  if (!domains.length && !flows.length) return [];
  const L = [
    ...head(repo, "business domains"),
    SNAPSHOT,
    USE_RULES,
    "",
    `\`${graphPath}\` holds ${domains.length} domains, ${flows.length} flows and ${steps.length} steps.`,
    `This slice carries the **domains in full** and the flows as a list. The ${steps.length} step-level`,
    "nodes are NOT here — read them from that file when a specific flow needs them.",
    "These are the tool's readings, not decisions.",
    "",
  ];
  if (dg._whole) {
    L.push(
      "⚠️ **Not split by repo.** This workspace map's steps carry no file paths, so the whole domain graph",
      "is shown for every repo; decide from the source which flows run in this one.",
      "",
    );
  }

  for (const n of domains) {
    L.push(`## ${str(n.name) || "?"}`, "");
    if (str(n.summary)) L.push(str(n.summary), "");
    const dm = ((n.domainMeta as Dict) ?? {}) as Dict;
    for (const [key, label] of [
      ["entities", "entities"],
      ["businessRules", "business rules"],
      ["crossDomainInteractions", "cross-domain interactions"],
    ] as const) {
      const vals = strs(dm[key]);
      if (vals.length) L.push(`- **${label}**:`, ...vals.map((v) => `  - ${v}`));
    }
    if (str(dm.entryPoint)) {
      L.push(`- **entry point**: \`${str(dm.entryPoint)}\` (${str(dm.entryType) || "?"})`);
    }
    L.push("");
  }

  if (flows.length) {
    L.push("## Flows", "");
    const rows = flows.map((f) => {
      const dm = ((f.domainMeta as Dict) ?? {}) as Dict;
      const entry = str(dm.entryPoint) ? ` · entry \`${str(dm.entryPoint)}\`` : "";
      return [`**${str(f.name) || "?"}**`, `${firstSentence(str(f.summary))}${entry}`] as [string, string];
    });
    L.push(...table(rows, ["flow", "what it does"]));
    L.push("");
  }
  return L;
}

// --- workspace map (one map over several repos) -----------------------------

/** The repo a node belongs to: the first segment of its file path, or of the path inside its id
 * (`file:<path>`, `function:<path>:<name>`) when the node carries no `filePath`. */
function nodeRepo(n: Dict, repos: Set<string>): string | null {
  let path = str(n.filePath);
  if (!path) {
    const m = /^[a-z_-]+:([^:]+)/.exec(str(n.id));
    path = m ? m[1] : "";
  }
  const first = path.replace(/^\.\//, "").split("/")[0];
  return repos.has(first) ? first : null;
}

/** The child directories of a map root that are git checkouts AND carry nodes in the map. A root that
 * is itself a checkout is a per-repo map, never a workspace map. */
function workspaceRepos(rootDir: string, g: Dict | null, s: Dict | null): string[] {
  if (existsSync(join(rootDir, ".git"))) return [];
  let kids: string[];
  try {
    kids = readdirSync(rootDir, { withFileTypes: true })
      .filter((e) => (e.isDirectory() || e.isSymbolicLink()) && !e.name.startsWith(".") && existsSync(join(rootDir, e.name, ".git")))
      .map((e) => e.name);
  } catch {
    return [];
  }
  const set = new Set(kids);
  const seen = new Set<string>();
  for (const n of arr(g?.nodes)) {
    const r = nodeRepo(n, set);
    if (r) seen.add(r);
  }
  for (const f of arr(s?.files)) {
    const path = str((f as Dict).path) || str(f as unknown);
    const first = path.split("/")[0];
    if (set.has(first)) seen.add(first);
  }
  return [...seen].sort();
}

type Part = { graph: Dict | null; scan: Dict | null; domain: Dict | null; cross: [string, number][]; share: string };

/** One repo's part of a workspace map, in the same shapes the per-repo slices read. */
function partOf(repo: string, repos: Set<string>, g: Dict | null, s: Dict | null, dg: Dict | null): Part {
  const inRepo = (n: Dict) => nodeRepo(n, repos) === repo;
  let graph: Dict | null = null;
  const cross = new Map<string, number>();
  let share = "";
  if (g) {
    const nodes = arr(g.nodes).filter(inRepo);
    const ids = new Set(nodes.map((n) => str(n.id)));
    const owner = new Map<string, string | null>(arr(g.nodes).map((n) => [str(n.id), nodeRepo(n, repos)]));
    const edges: Dict[] = [];
    for (const e of arr(g.edges)) {
      const a = ids.has(str(e.source));
      const b = ids.has(str(e.target));
      if (a && b) edges.push(e);
      else if (a || b) {
        const other = owner.get(a ? str(e.target) : str(e.source)) ?? "(outside any repo)";
        const key = `${a ? "→" : "←"} ${other} · ${str(e.type) || "?"}`;
        cross.set(key, (cross.get(key) ?? 0) + 1);
      }
    }
    const layers = arr(g.layers)
      .map((l) => ({ ...l, nodeIds: strs(l.nodeIds).filter((x) => ids.has(x)) }))
      .filter((l) => l.nodeIds.length > 0);
    const tour = arr(g.tour)
      .map((t) => ({ ...t, nodeIds: strs(t.nodeIds).filter((x) => ids.has(x)) }))
      .filter((t) => t.nodeIds.length > 0);
    graph = { ...g, nodes, edges, layers, tour };
    share = `${nodes.length} of ${arr(g.nodes).length} nodes`;
  }
  let scan: Dict | null = null;
  if (s) {
    const imports = ((s.importMap as Dict) ?? {}) as Record<string, unknown>;
    const mine = Object.fromEntries(Object.entries(imports).filter(([k]) => k.split("/")[0] === repo));
    const files = arr(s.files).filter((f) => (str((f as Dict).path) || str(f as unknown)).split("/")[0] === repo);
    scan = { ...s, importMap: mine, files, totalFiles: files.length };
  }
  let domain: Dict | null = null;
  if (dg) {
    // domain > flow > step. Keep the steps whose file is in this repo, then the flows and domains
    // linked to them by any edge. A map whose steps carry no file paths cannot be split this way, so
    // it goes to every repo whole, and the slice says so.
    const nodes = arr(dg.nodes);
    const byId = new Map(nodes.map((n) => [str(n.id), n]));
    const adj = new Map<string, Set<string>>();
    for (const e of arr(dg.edges)) {
      const a = str(e.source);
      const b = str(e.target);
      if (!adj.has(a)) adj.set(a, new Set());
      if (!adj.has(b)) adj.set(b, new Set());
      adj.get(a)?.add(b);
      adj.get(b)?.add(a);
    }
    const steps = nodes.filter((n) => str(n.type) === "step");
    if (!steps.some((n) => str(n.filePath))) {
      domain = { ...dg, _whole: true };
    } else {
      const keep = new Set(steps.filter(inRepo).map((n) => str(n.id)));
      for (const kind of ["flow", "domain"]) {
        for (const id of [...keep]) {
          for (const nb of adj.get(id) ?? []) if (str(byId.get(nb)?.type) === kind) keep.add(nb);
        }
      }
      domain = { ...dg, nodes: nodes.filter((n) => keep.has(str(n.id))) };
    }
  }
  return { graph, scan, domain, cross: [...cross.entries()].sort((a, b) => b[1] - a[1]), share };
}

/** `<root>/.ua/repo-heads.json` — each repo's HEAD when the workspace map was built. */
const HEADS_FILE = "repo-heads.json";
function recordedHeads(ua: string): Record<string, string> {
  const d = load(join(ua, HEADS_FILE));
  const repos = ((d?.repos as Dict) ?? {}) as Record<string, unknown>;
  return Object.fromEntries(Object.entries(repos).filter(([, v]) => typeof v === "string")) as Record<string, string>;
}

function recordHeads(rootArg: string): void {
  const rootDir = resolve(rootArg);
  const ua = join(rootDir, ".ua");
  if (!existsSync(join(ua, "knowledge-graph.json"))) fail(`no finished map at ${ua} — record heads right after the analysis finishes`);
  const graph = load(join(ua, "knowledge-graph.json"));
  const repos = workspaceRepos(rootDir, graph, load(join(ua, "intermediate", "scan-result.json")));
  if (!repos.length) fail(`${rootDir} is not a workspace map root (a git checkout itself, or no child repo appears in the map)`);
  const heads: Record<string, string> = {};
  for (const r of repos) {
    const h = headCommit(join(rootDir, r));
    if (h) heads[r] = h;
  }
  const out = join(ua, HEADS_FILE);
  const owner = privateMode(join(ua, "knowledge-graph.json"));
  writeFileSync(out, JSON.stringify({ recordedAt: new Date().toISOString(), repos: heads }, null, 2) + "\n", {
    encoding: "utf-8",
    ...(owner ? { mode: 0o600 } : {}),
  });
  console.log(`recorded ${Object.keys(heads).length} repo HEADs → ${out}`);
  for (const [r, h] of Object.entries(heads)) console.log(`  ${r.padEnd(32)} ${h.slice(0, 12)}`);
}

// --- writing ----------------------------------------------------------------

/** Files from ua-plugin 0.2.0 and earlier: one fixed name per kind, no repo in the name. Named, not
 * removed — they were written into the person's workspace, and deleting them is the person's call. */
function legacyFiles(workspace: string, space: string): string[] {
  const found: string[] = [];
  for (const [owner, kind] of OWNERS) {
    const rel = KNOWLEDGE(space, owner, `${kind}.md`);
    const abs = join(workspace, rel);
    if (!existsSync(abs)) continue;
    const first = readFileSync(abs, "utf-8").split("\n", 1)[0];
    if (first.startsWith(HEADING)) found.push(rel);
  }
  return found;
}

/** A map kept owner-only stays owner-only: when the map file has no group/other permission bits, its
 * converted copies get none either. */
function privateMode(source: string): boolean {
  try {
    return (statSync(source).mode & 0o077) === 0;
  } catch {
    return false;
  }
}

function fail(msg: string): never {
  console.log(`❌ ${msg}`);
  process.exit(2);
}

type Result = { missing: string[] };

function convert(repoArg: string, workspace: string | null, space: string, dryRun: boolean): Result {
  const repoDir = resolve(repoArg);
  const ua = join(repoDir, ".ua");
  if (!existsSync(ua)) {
    fail(`no \`.ua/\` at ${ua} — run Understand-Anything first (installing and running it is yours)`);
  }

  const graphPath = join(ua, "knowledge-graph.json");
  let graph = load(graphPath);
  if (graph && !arr(graph.nodes).length && !arr(graph.layers).length) graph = null;
  const scanPath = join(ua, "intermediate", "scan-result.json");
  const scan = load(scanPath);
  const domain = load(join(ua, "domain-graph.json"));
  const meta = load(join(ua, "meta.json"));
  if (!graph && !scan) {
    fail(`nothing to read: ${ua} has neither knowledge-graph.json nor scan-result.json`);
  }
  const wsRepos = workspaceRepos(repoDir, graph, scan);
  if (wsRepos.length) {
    const set = new Set(wsRepos);
    const heads = recordedHeads(ua);
    const missing = new Set<string>();
    console.log(`workspace map: ${repoDir} → ${wsRepos.length} repos (${wsRepos.join(", ")})`);
    for (const r of wsRepos) {
      if (!/^[A-Za-z0-9._-]+$/.test(r)) fail(`repo name \`${r}\` cannot be used in a file name`);
      const part = partOf(r, set, graph, scan, domain);
      const res = emit(r, join(repoDir, r), part.graph, part.scan, part.domain, meta, ua, graphPath, scanPath, workspace, space, dryRun, {
        ws: { root: basename(repoDir), share: part.share, recorded: heads[r] ?? null },
        cross: part.cross,
        domainPath: ".ua/domain-graph.json",
      });
      for (const m of res.missing) missing.add(m);
    }
    return { missing: [...missing] };
  }
  const repo = basename(repoDir);
  if (!/^[A-Za-z0-9._-]+$/.test(repo)) fail(`repo name \`${repo}\` cannot be used in a file name`);
  return emit(repo, repoDir, graph, scan, domain, meta, ua, graphPath, scanPath, workspace, space, dryRun, null);
}

function emit(
  repo: string,
  repoDir: string,
  graph: Dict | null,
  scan: Dict | null,
  domain: Dict | null,
  meta: Dict | null,
  ua: string,
  graphPath: string,
  scanPath: string,
  workspace: string | null,
  space: string,
  dryRun: boolean,
  wsx: { ws: WsInfo; cross: [string, number][]; domainPath: string } | null,
): Result {
  let slices: { target: readonly [string, string]; body: string[]; why: string }[] = [];
  if (graph) {
    const body = architectSlice(repo, graph);
    if (body.length) slices.push({ target: ARCHITECT, body, why: "layer descriptions, node census" });
  }
  {
    const body = developerSlice(repo, graph, scan, wsx?.cross ?? []);
    if (body.length) {
      slices.push({ target: DEVELOPER, body, why: "hot files, relationship census, tag prefixes, import fan-out, tour" });
    }
  }
  if (domain) {
    const body = productSlice(repo, domain, wsx?.domainPath);
    if (body.length) slices.push({ target: PRODUCT, body, why: "business domains, entities, rules, flows" });
  }

  // Check the target agents actually exist in this workspace. Writing to a name nobody reads is a
  // silent failure, so skip that slice, say so, and exit non-zero.
  const missing: string[] = [];
  if (workspace !== null) {
    const names = roster(workspace);
    if (names === null) {
      console.log("⚠️ no agent roster found (<ws>/.*/agents/*.md) — skipping the agent-slice check");
    } else {
      slices = slices.filter((s) => {
        if (names.has(s.target[0])) return true;
        missing.push(s.target[0]);
        return false;
      });
    }
  }

  const extra: [string, string][] = slices.map((s) => [
    KNOWLEDGE(space, s.target[0], fileName(s.target[1], repo)),
    s.why,
  ]);
  const written: { target: readonly [string, string]; body: string[] }[] = [
    { target: SHARED, body: sharedSlice(repo, repoDir, graph, scan, meta, guides(ua), extra, wsx?.ws ?? null) },
    ...slices.map((s) => ({ target: s.target, body: s.body })),
  ];

  const owner = privateMode(graph ? graphPath : scanPath);
  console.log(`repo: ${repo}  (${repoDir})`);
  for (const { target, body } of written) {
    const text = body.join("\n").replace(/\n+$/, "") + "\n";
    const rel = KNOWLEDGE(space, target[0], fileName(target[1], repo));
    const nbytes = Buffer.byteLength(text, "utf-8");
    if (dryRun || workspace === null) {
      console.log(`  ${rel.padEnd(78)} ${String(nbytes).padStart(7)} B`);
      continue;
    }
    const out = join(workspace, rel);
    mkdirSync(dirname(out), { recursive: true, ...(owner ? { mode: 0o700 } : {}) });
    const same = existsSync(out) && readFileSync(out, "utf-8") === text;
    if (!same) writeFileSync(out, text, { encoding: "utf-8", ...(owner ? { mode: 0o600 } : {}) });
    console.log(`  ${rel.padEnd(78)} ${String(nbytes).padStart(7)} B  ${same ? "unchanged" : "written"}`);
  }
  let src = graph ? "knowledge-graph.json" : "intermediate/scan-result.json";
  if (domain) src += " + domain-graph.json";
  console.log(`  source: ${src}`);
  return { missing };
}

function main(): void {
  const argv = process.argv.slice(2);
  const positional: string[] = [];
  let workspace: string | null = null;
  let space = "default";
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--workspace") workspace = argv[++i] ?? fail("--workspace needs a path");
    else if (a === "--space") space = argv[++i] ?? fail("--space needs a name");
    else if (a === "--dry-run") dryRun = true;
    else if (a === "--record-heads") {
      recordHeads(argv[++i] ?? fail("--record-heads needs the map root"));
      return;
    }
    else if (a.startsWith("--")) fail(`unknown flag: ${a}`);
    else positional.push(a);
  }
  if (positional.length === 0) {
    fail(
      "usage: ua-code-map.ts <analyzed-repo-or-map-root> [...] --workspace <ws> [--space default] [--dry-run]\n" +
        "       ua-code-map.ts --record-heads <map-root>",
    );
  }
  const repos = positional.map((p) => basename(resolve(p)));
  const dup = repos.find((r, i) => repos.indexOf(r) !== i);
  if (dup) fail(`two analysed trees share the repo name \`${dup}\` — their files would collide`);

  const missing = new Set<string>();
  for (const p of positional) for (const m of convert(p, workspace, space, dryRun).missing) missing.add(m);

  if (workspace !== null) {
    const legacy = legacyFiles(workspace, space);
    if (legacy.length) {
      console.log("⚠️ files from ua-plugin 0.2.0 or earlier (no repo in the name) are still loaded by every agent:");
      for (const f of legacy) console.log(`   ${f}`);
      console.log("   delete them once the per-repo files above are in place.");
    }
  }
  if (missing.size) {
    console.log(`🔴 slices not written — no such agent in this workspace: ${[...missing].sort().join(", ")}`);
    console.log("   this distribution has a different persona roster — check the names and fix the mapping.");
    process.exit(1);
  }
}

main();
