#!/usr/bin/env bun
/**
 * Turn external code maps (Graphify's `<repo>/graphify-out/`) into the workspace's knowledge
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
 *   aidlc-shared/graphify-code-map.<repo>.md       provenance, freshness, stack, areas, pointers
 *   <architect>/graphify-architecture.<repo>.md    community structure, directory concentration, seams
 *   <developer>/graphify-structure.<repo>.md       hub nodes, relation census, hot files, edges to confirm
 *   <product>/graphify-documents.<repo>.md         non-code nodes — only when the map has any
 *
 * Delegated stages (subagent/pipeline) get no inline roster, but the stock persona carries a
 * `<!-- aidlc-delegated-knowledge-preflight -->` sentinel whose paragraph mandates loading the
 * shell's `knowledge/{aidlc-shared,<agent>}/` and then `aidlc/spaces/<space>/knowledge/
 * {aidlc-shared,<agent>}/` — so they are covered too. Anchor on that sentinel, not on a heading
 * title: the heading that used to carry this was renamed, and the load is no longer conditional.
 *
 * The rules for USING a code map live in `aidlc-shared/external-code-map.md`, which this plugin
 * ships as knowledge; the files this script writes carry provenance and facts only.
 *
 * Schema source of truth: measured from Graphify 0.9.54's own output, not from its prose docs —
 * the two disagree on one load-bearing point. `graph.json` is NetworkX **node-link** format:
 * {directed, multigraph, graph, nodes[], links[], hyperedges[], built_at_commit?}. The edge array
 * is `links`, NOT `edges` (the docs say "edges"). 🔴 `built_at_commit` is **top-level** and `graph`
 * is `{}` — an earlier reading of this placed the commit inside `graph`, which made every
 * commit-bearing map report as having none. Node: {id, label, norm_label, file_type,
 * community, source_file, source_location, _origin, _callable?, _callable_class?, metadata?}.
 * Link: {source, target, relation, confidence, confidence_score, weight, source_file,
 * source_location, _origin, context?}.
 *
 * Two absences shape every slice below, and both are deliberate on Graphify's side:
 *   1. There is NO `project` block — provenance is synthesised here from the graph itself.
 *   2. Nodes carry NO summary — the AST pass is deterministic and free, and prose summaries are
 *      what an LLM pass would add. So these slices are built from structure (degree, community,
 *      directory, relation kind) instead of from sentences. Do not add invented summaries.
 *
 * Usage:
 *   bun <harness>/tools/graphify-map.ts <analyzed-repo> [...] --workspace <ws> [--space default]
 *   bun <harness>/tools/graphify-map.ts <analyzed-repo> [...] --dry-run
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const KNOWLEDGE = (space: string, owner: string, name: string) =>
  `aidlc/spaces/${space}/knowledge/${owner}/${name}`;
const SHARED = ["aidlc-shared", "graphify-code-map"] as const;
const ARCHITECT = ["aidlc-architect-agent", "graphify-architecture"] as const;
const DEVELOPER = ["aidlc-developer-agent", "graphify-structure"] as const;
const PRODUCT = ["aidlc-product-agent", "graphify-documents"] as const;
const OWNERS = [SHARED, ARCHITECT, DEVELOPER, PRODUCT];

/** The file a slice lands in for one repo. The repo name sits between the kind and `.md`, so names
 * of repos that share a prefix (`app`, `app-web`) can never collide. */
const fileName = (kind: string, repo: string) => `${kind}.${repo}.md`;

const USE_RULES =
  "Rules for using this: `aidlc-shared/external-code-map.md`, which every agent loads with its knowledge.";
const SNAPSHOT =
  "⚠️ A snapshot. Confirm anything you use against the source file, and cite that file — not this one.";

const TOP_COMMUNITIES = 12;
const TOP_HUBS = 20;
const TOP_FILES = 20;
const TOP_INFERRED = 15;

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
const num = (v: unknown): number => (typeof v === "number" ? v : 0);

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

const HEADING = "# External code map — ";
const head = (repo: string, kind: string): string[] => [`${HEADING}\`${repo}\` · ${kind}`, ""];

/** Extension → language, for the stack row. Graphify records no language field, so the stack is
 * derived from the paths it did record; an unmapped extension is reported by extension so the row
 * never silently drops part of the tree. */
const LANGS: Record<string, string> = {
  java: "Java", kt: "Kotlin", scala: "Scala", groovy: "Groovy",
  ts: "TypeScript", tsx: "TypeScript", mts: "TypeScript", cts: "TypeScript",
  js: "JavaScript", jsx: "JavaScript", mjs: "JavaScript", cjs: "JavaScript",
  py: "Python", go: "Go", rs: "Rust", rb: "Ruby", php: "PHP", swift: "Swift",
  cs: "C#", c: "C", h: "C", cpp: "C++", hpp: "C++", cc: "C++",
  vue: "Vue", svelte: "Svelte", astro: "Astro",
  sql: "SQL", tf: "Terraform", hcl: "Terraform", gradle: "Gradle",
  md: "Markdown", json: "JSON", yaml: "YAML", yml: "YAML", xml: "XML",
  css: "CSS", scss: "CSS", html: "HTML", properties: "Properties",
};

const ext = (p: string): string => {
  const b = basename(p);
  const i = b.lastIndexOf(".");
  return i > 0 ? b.slice(i + 1).toLowerCase() : "";
};

/** The area a node sits in: the top two segments of its directory.
 *
 * Graphify has no `layers[]`, so "which part of the system" has to come from the path. Two
 * segments is what separated `backend/src` from `frontend/src` on the measured corpus without
 * collapsing everything into one bucket.
 *
 * A node with NO `source_file` is not a root-level file — on the measured corpus those 43 nodes
 * were all imported library symbols (`org.springframework.*`, `com.fasterxml.*`) that the AST pass
 * referenced but never resolved to a file in this tree. Calling that "(root)" would invent a
 * location, so it gets its own label. */
const EXTERNAL = "(external — no file in this tree)";

const area = (p: string): string => {
  if (p === "") return EXTERNAL;
  const d = dirname(p);
  if (d === "." || d === "") return "(tree root)";
  return d.split("/").slice(0, 2).join("/");
};

interface Graph {
  nodes: Dict[];
  links: Dict[];
  meta: Dict;
  degree: Map<string, number>;
  byId: Map<string, Dict>;
}

function read(graphPath: string): Graph | null {
  const raw = load(graphPath);
  if (!raw) return null;
  const nodes = arr(raw.nodes);
  const links = arr(raw.links);
  if (!nodes.length) return null;
  const degree = new Map<string, number>();
  const bump = (k: string) => degree.set(k, (degree.get(k) ?? 0) + 1);
  for (const l of links) {
    bump(str(l.source));
    bump(str(l.target));
  }
  const byId = new Map<string, Dict>();
  for (const n of nodes) byId.set(str(n.id), n);
  // 🔴 `built_at_commit` sits at the TOP level, not inside `graph`. Measured: `to_json` does
  // `data["built_at_commit"] = commit` on the same object it writes, one line below
  // `data["hyperedges"]` — and `hyperedges` is top-level in the output. `graph` is `{}`.
  // An earlier version of this reader looked only inside `graph`, so it never found a commit and
  // reported "tooling gap" on graphs that carried one. Read both, top level first, so a future
  // upstream move into `graph` still resolves.
  const g = (raw.graph as Dict) ?? {};
  const meta: Dict = { ...g, built_at_commit: raw.built_at_commit ?? g.built_at_commit };
  return { nodes, links, meta, degree, byId };
}

/** A node's display name, with its file when there is one. Labels repeat across files (`toString`,
 * `handle`), so a bare label is ambiguous in a list. */
function nameOf(n: Dict): string {
  const label = str(n.label) || str(n.id);
  const f = str(n.source_file);
  return f ? `\`${label}\` — \`${f}\`` : `\`${label}\``;
}

/** The provenance row for the commit the map came from.
 *
 * Graphify omits `built_at_commit` entirely outside a git repo rather than writing an empty or
 * null value (`export.py`: the key is set only `if commit`). So an absent key is the tool working
 * as designed, not a tooling gap — say which of the two this is, and never render a blank. */
function commitRow(repoDir: string, meta: Dict): string {
  const hash = str(meta.built_at_commit);
  const isCheckout = existsSync(join(repoDir, ".git"));
  if (hash === "") {
    // A git checkout with no commit recorded is usually the tool's FIRST build there, not a
    // corrupted map. Measured: the tool resolves the commit with `git rev-parse HEAD` run inside
    // the output directory, and that directory is created only afterwards — so the lookup throws on
    // a first build and the key is omitted. A rebuild records it.
    return isCheckout
      ? "not recorded — the tree IS a git checkout, so this is most likely the tool's first build here (it resolves the commit inside its own output directory, which does not exist yet on that run). **Rebuild and the commit appears.**"
      : "not recorded — the analysed tree is not a git checkout. Freshness rests on the tool's per-file content hashes (`graphify-out/cache/`), not on a commit";
  }
  return isCheckout
    ? `\`${hash}\``
    : `\`${hash}\` ⚠️ **unverifiable** — the analysed tree has no \`.git\`, so this hash came from elsewhere`;
}

/** The analysed tree's current HEAD, or null when it is not a git checkout or git is unavailable. */
function headCommit(repoDir: string): string | null {
  if (!existsSync(join(repoDir, ".git"))) return null;
  const r = spawnSync("git", ["-C", repoDir, "rev-parse", "HEAD"], { encoding: "utf-8" });
  if (r.status !== 0) return null;
  const out = r.stdout.trim();
  return /^[0-9a-f]{7,64}$/.test(out) ? out : null;
}

/** Whether the map's commit is still the tree's HEAD, as measured at conversion time. A prefix
 * match counts: the tool may record a short hash. Without a commit, freshness rests on the tool's
 * content hashes, and a code-only rebuild is free — so the row says to rebuild rather than guess. */
function freshnessRow(hash: string, head: string | null): string {
  if (hash === "") return "unknown — the map records no commit; a code-only rebuild (`graphify update .`) is free";
  if (head === null) return "unknown — no git HEAD could be read in the analysed tree";
  const same = head.startsWith(hash) || hash.startsWith(head);
  return same
    ? `map commit is HEAD (\`${head.slice(0, 12)}\`) at conversion time`
    : `🔴 **stale** — HEAD is \`${head.slice(0, 12)}\`; files changed since the map's commit are not mapped`;
}

// --- shared slice -----------------------------------------------------------

function sharedSlice(
  repo: string,
  repoDir: string,
  g: Graph,
  graphPath: string,
  extra: [string, string][],
): string[] {
  const L = head(repo, "orientation");
  const langs = tally(
    g.nodes.map((n) => LANGS[ext(str(n.source_file))] ?? "").filter((v) => v !== ""),
  );
  const conf = tally(g.links.map((l) => str(l.confidence) || "(untagged)"));
  const communities = new Set(g.nodes.map((n) => String(n.community ?? "")));

  // Relative, never the absolute path this ran from: an absolute path in a workspace artifact is
  // wrong on the next machine and leaks the operator's layout. The repo it is relative to is in
  // the title above.
  L.push(...table(
    [
      ["source", `\`${graphPath}\``],
      ["git commit", commitRow(repoDir, g.meta)],
      ["freshness", freshnessRow(str(g.meta.built_at_commit), headCommit(repoDir))],
      ["nodes / edges", `${g.nodes.length} / ${g.links.length}`],
      ["communities", String(communities.size)],
      ["edge confidence", conf.map(([k, c]) => `${k} ${c}`).join(" · ")],
    ],
    ["provenance", "value"],
  ));
  L.push("", SNAPSHOT, USE_RULES, "");

  L.push("## Stack (derived from the paths the tool recorded)", "");
  L.push(
    langs.length
      ? langs.map(([k, c]) => `- ${k} — ${c} nodes`).join("\n")
      : "- none — no node carries a recognised source path",
  );
  L.push("");

  L.push("## Areas (top path segments, not the tool's own grouping)", "");
  L.push(...table(
    tally(g.nodes.map((n) => area(str(n.source_file))))
      .slice(0, TOP_COMMUNITIES)
      .map(([a, c]) => [`\`${a}\``, `${c} nodes`]),
    ["area", "size"],
  ));
  L.push("");

  L.push(
    "🔴 **This tool records no per-node summary and no named layers.** What is here is measured",
    "structure — degree, community membership, path. Do not read a community number as a designed",
    "module, and do not invent a description for one: open the files it points at instead.",
    "",
  );

  if (extra.length) {
    L.push("## Detail lives with the agent that owns it", "");
    L.push(...table(extra.map(([p, why]) => [`\`${p}\``, why]), ["file", "what it carries"]));
    L.push("");
  }
  return L;
}

// --- architect slice --------------------------------------------------------

function architectSlice(repo: string, g: Graph): string[] {
  const L = head(repo, "architecture");
  const members = new Map<string, Dict[]>();
  for (const n of g.nodes) {
    const c = String(n.community ?? "");
    (members.get(c) ?? members.set(c, []).get(c)!).push(n);
  }
  const ordered = [...members.entries()].sort((a, b) => b[1].length - a[1].length);

  L.push(
    "Communities are the tool's own grouping — computed from edge density, with no embeddings.",
    "**They are unnamed by construction.** Each row below gives the community's size, where its",
    "files sit, and its highest-degree members, so you can decide what it is by reading those.",
    "",
  );
  for (const [cid, ns] of ordered.slice(0, TOP_COMMUNITIES)) {
    const areas = tally(ns.map((n) => area(str(n.source_file)))).slice(0, 3);
    const hubs = [...ns]
      .sort((a, b) => (g.degree.get(str(b.id)) ?? 0) - (g.degree.get(str(a.id)) ?? 0))
      .slice(0, 5);
    L.push(`### Community ${cid} — ${ns.length} nodes`, "");
    L.push(`- areas: ${areas.map(([a, c]) => `\`${a}\` (${c})`).join(", ")}`);
    L.push(`- highest degree: ${hubs.map((n) => nameOf(n)).join(", ")}`);
    L.push("");
  }
  if (ordered.length > TOP_COMMUNITIES) {
    L.push(`_${ordered.length - TOP_COMMUNITIES} smaller communities not listed._`, "");
  }

  // Cross-community edges are the seams: where one group reaches into another.
  const seams = tally(
    g.links
      .map((l) => {
        const a = g.byId.get(str(l.source));
        const b = g.byId.get(str(l.target));
        if (!a || !b) return "";
        const ca = String(a.community ?? "");
        const cb = String(b.community ?? "");
        return ca === cb ? "" : `${ca} → ${cb}`;
      })
      .filter((v) => v !== ""),
  );
  L.push("## Seams — edges that cross a community boundary", "");
  L.push(
    seams.length
      ? [
          ...table(seams.slice(0, TOP_COMMUNITIES).map(([k, c]) => [k, String(c)]), [
            "from → to",
            "edges",
          ]),
          "",
          "A heavy pair is a coupling worth reading before you describe the architecture.",
        ].join("\n")
      : "None — every edge stays inside its community.",
  );
  L.push("");
  return L;
}

// --- developer slice --------------------------------------------------------

function developerSlice(repo: string, g: Graph): string[] {
  const L = head(repo, "structure");

  L.push("## Hub nodes (highest degree)", "");
  const hubs = [...g.nodes]
    .sort((a, b) => (g.degree.get(str(b.id)) ?? 0) - (g.degree.get(str(a.id)) ?? 0))
    .slice(0, TOP_HUBS);
  L.push(...table(
    hubs.map((n) => [nameOf(n), String(g.degree.get(str(n.id)) ?? 0)]),
    ["node", "degree"],
  ));
  L.push("", "A hub is where a change spreads from. It is not automatically a defect.", "");

  L.push("## Relations the tool resolved", "");
  L.push(...table(
    tally(g.links.map((l) => str(l.relation) || "(none)")).map(([k, c]) => [`\`${k}\``, String(c)]),
    ["relation", "count"],
  ));
  L.push("");

  L.push("## Hot files (most nodes)", "");
  L.push(...table(
    tally(g.nodes.map((n) => str(n.source_file)).filter((v) => v !== ""))
      .slice(0, TOP_FILES)
      .map(([f, c]) => [`\`${f}\``, String(c)]),
    ["file", "nodes"],
  ));
  L.push("");

  // The confirmation budget: EXTRACTED edges are already source citations, INFERRED ones are the
  // tool's own deduction and AMBIGUOUS ones it flagged itself. Listing the latter two is what
  // makes "confirm at the source" affordable instead of blanket.
  const soft = g.links
    .filter((l) => {
      const c = str(l.confidence);
      return c !== "" && c !== "EXTRACTED";
    })
    .sort((a, b) => num(b.confidence_score) - num(a.confidence_score));
  L.push("## Edges to confirm before you rely on them", "");
  if (!soft.length) {
    L.push("None — every edge in this map is tagged `EXTRACTED`.", "");
  } else {
    L.push(
      `${soft.length} of ${g.links.length} edges are not \`EXTRACTED\`. The highest-scoring are listed;`,
      "confirm one at its `source_file` before a claim built on it reaches an artifact.",
      "",
    );
    L.push(...table(
      soft.slice(0, TOP_INFERRED).map((l) => {
        const a = g.byId.get(str(l.source));
        const b = g.byId.get(str(l.target));
        const an = a ? str(a.label) : str(l.source);
        const bn = b ? str(b.label) : str(l.target);
        const loc = [str(l.source_file), str(l.source_location)].filter((v) => v !== "").join(":");
        return [
          `\`${an}\` --${str(l.relation)}--> \`${bn}\``,
          `${str(l.confidence)}${loc ? ` · \`${loc}\`` : ""}`,
        ];
      }),
      ["edge", "tag · where"],
    ));
    L.push("");
  }
  return L;
}

// --- product slice ----------------------------------------------------------

/** Non-code nodes, when the map has any.
 *
 * Graphify's AST pass emits `file_type: code` only. Documents, papers, images and rationale nodes
 * appear when the tool's semantic pass ran over prose. So this slice is conditional on evidence,
 * not on configuration: with a code-only map it returns empty and no file is written. */
function productSlice(repo: string, g: Graph): string[] {
  const nonCode = g.nodes.filter((n) => str(n.file_type) !== "code");
  if (!nonCode.length) return [];
  const L = head(repo, "documents and concepts");
  L.push(
    "These nodes came from prose and diagrams rather than from source files. They carry intent,",
    "so they are the part of this map worth reading in full — and the part most likely to be stale,",
    "because a document changes without a code change.",
    "",
  );
  L.push(...table(
    tally(nonCode.map((n) => str(n.file_type) || "(untyped)")).map(([k, c]) => [`\`${k}\``, String(c)]),
    ["kind", "count"],
  ));
  L.push("");
  for (const [kind] of tally(nonCode.map((n) => str(n.file_type) || "(untyped)"))) {
    const ns = nonCode.filter((n) => (str(n.file_type) || "(untyped)") === kind);
    L.push(`### ${kind} — ${ns.length}`, "");
    for (const n of ns.slice(0, TOP_FILES)) {
      L.push(`- ${nameOf(n)} · degree ${g.degree.get(str(n.id)) ?? 0}`);
    }
    if (ns.length > TOP_FILES) L.push(`- _${ns.length - TOP_FILES} more not listed._`);
    L.push("");
  }
  return L;
}

// --- writing ----------------------------------------------------------------

/** Files from graphify-plugin 0.1.0: one fixed name per kind, no repo in the name.
 * Named, not removed — they were written into the person's workspace, and deleting them is the
 * person's call. */
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

function fail(msg: string): never {
  console.log(`❌ ${msg}`);
  process.exit(2);
}

function convert(repoArg: string, workspace: string | null, space: string, dryRun: boolean): string[] {
  const repoDir = resolve(repoArg);
  const out = join(repoDir, "graphify-out");
  if (!existsSync(out)) {
    fail(`no \`graphify-out/\` at ${out} — run Graphify first (installing and running it is yours)`);
  }
  const graphPath = join(out, "graph.json");
  const g = read(graphPath);
  if (!g) {
    fail(
      `nothing to read: ${graphPath} is missing, unparseable, or has no nodes — a map with only ` +
        `\`graphify-out/cache/\` is mid-build, so treat it as absent`,
    );
  }
  const repo = basename(repoDir);
  if (!/^[A-Za-z0-9._-]+$/.test(repo)) fail(`repo name \`${repo}\` cannot be used in a file name`);

  let slices: { target: readonly [string, string]; body: string[]; why: string }[] = [];
  {
    const body = architectSlice(repo, g);
    if (body.length) {
      slices.push({ target: ARCHITECT, body, why: "community structure, areas, cross-community seams" });
    }
  }
  {
    const body = developerSlice(repo, g);
    if (body.length) {
      slices.push({ target: DEVELOPER, body, why: "hub nodes, relation census, hot files, edges to confirm" });
    }
  }
  {
    const body = productSlice(repo, g);
    if (body.length) {
      slices.push({ target: PRODUCT, body, why: "document, paper and concept nodes" });
    }
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
    { target: SHARED, body: sharedSlice(repo, repoDir, g, "graphify-out/graph.json", extra) },
    ...slices.map((s) => ({ target: s.target, body: s.body })),
  ];

  console.log(`repo: ${repo}  (${repoDir})`);
  for (const { target, body } of written) {
    const text = body.join("\n").replace(/\n+$/, "") + "\n";
    const rel = KNOWLEDGE(space, target[0], fileName(target[1], repo));
    const nbytes = Buffer.byteLength(text, "utf-8");
    if (dryRun || workspace === null) {
      console.log(`  ${rel.padEnd(78)} ${String(nbytes).padStart(7)} B`);
      continue;
    }
    const outFile = join(workspace, rel);
    mkdirSync(dirname(outFile), { recursive: true });
    const same = existsSync(outFile) && readFileSync(outFile, "utf-8") === text;
    if (!same) writeFileSync(outFile, text, "utf-8");
    console.log(`  ${rel.padEnd(78)} ${String(nbytes).padStart(7)} B  ${same ? "unchanged" : "written"}`);
  }
  console.log(`  source: graphify-out/graph.json (${g.nodes.length} nodes, ${g.links.length} links)`);
  return missing;
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
    else if (a.startsWith("--")) fail(`unknown flag: ${a}`);
    else positional.push(a);
  }
  if (positional.length === 0) {
    fail("usage: graphify-map.ts <analyzed-repo> [...] --workspace <ws> [--space default] [--dry-run]");
  }
  const repos = positional.map((p) => basename(resolve(p)));
  const dup = repos.find((r, i) => repos.indexOf(r) !== i);
  if (dup) fail(`two analysed trees share the repo name \`${dup}\` — their files would collide`);

  const missing = new Set<string>();
  for (const p of positional) for (const m of convert(p, workspace, space, dryRun)) missing.add(m);

  if (workspace !== null) {
    const legacy = legacyFiles(workspace, space);
    if (legacy.length) {
      console.log("⚠️ files from graphify-plugin 0.1.0 (no repo in the name) are still loaded by every agent:");
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
