#!/usr/bin/env bun
/**
 * Turn an external code map (Understand-Anything's `.ua/`) into the workspace's
 * knowledge overlay, split per agent.
 *
 * WHY SPLIT: inline and mob stages are handed `inline_context_paths` and the protocol makes the
 * agent read EVERY path as its first tool calls. Anything in `aidlc-shared/` is therefore paid by
 * ~30 stages on every run. So the shared file carries orientation plus pointers, and the bulky
 * slices sit with the agent that owns them. No content is duplicated.
 *
 *   aidlc-shared/ua-code-map.md              provenance, stack, layer names, tour titles, pointers
 *   <architect>/ua-architecture.md           layer descriptions, node census
 *   <developer>/ua-structure.md              hot files, edge census, import fan-out, full tour
 *   <product>/ua-domains.md                  domains in full, flows as a list (steps excluded)
 *
 * Delegated stages (subagent/pipeline) get no inline roster, but the stock persona carries a
 * `<!-- aidlc-delegated-knowledge-preflight -->` sentinel whose paragraph mandates loading the
 * shell's `knowledge/{aidlc-shared,<agent>}/` and then `aidlc/spaces/<space>/knowledge/
 * {aidlc-shared,<agent>}/` — so they are covered too. Anchor on that sentinel, not on a heading
 * title: the heading that used to carry this was renamed, and the load is no longer conditional.
 *
 * The rules for USING a code map live in `aidlc-shared/external-code-map.md`; the files this script
 * writes carry provenance and facts only.
 *
 * Schema source of truth: Understand-Anything `packages/core/src/types.ts` — `KnowledgeGraph`
 * {version, kind?, project{name,languages,frameworks,description,analyzedAt,gitCommitHash},
 *  nodes[{id,type,name,filePath?,summary,tags,complexity,domainMeta?}], edges[{source,target,type,
 *  weight}], layers[{id,name,description,nodeIds}], tour[{order,title,description,nodeIds}]} and
 * `DomainMeta` {entities?, businessRules?, crossDomainInteractions?, entryPoint?, entryType?}.
 *
 * Usage:
 *   bun <skill>/scripts/ua-code-map.ts <analyzed-repo> --workspace <ws> [--space default]
 *   bun <skill>/scripts/ua-code-map.ts <analyzed-repo> --dry-run
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const KNOWLEDGE = (space: string, owner: string, name: string) =>
  `aidlc/spaces/${space}/knowledge/${owner}/${name}`;
const SHARED = ["aidlc-shared", "ua-code-map.md"] as const;
const ARCHITECT = ["aidlc-architect-agent", "ua-architecture.md"] as const;
const DEVELOPER = ["aidlc-developer-agent", "ua-structure.md"] as const;
const PRODUCT = ["aidlc-product-agent", "ua-domains.md"] as const;

const USE_RULES =
  "Rules for using this: `external-code-map.md` under `aidlc/spaces/<space>/knowledge/aidlc-shared/`.";
const SNAPSHOT =
  "⚠️ A snapshot. Confirm anything you use against the source file, and cite that file — not this one.";

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
 * insertion order — matching the reference implementation's behaviour. */
function tally(values: string[]): [string, number][] {
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function table(rows: [string, string][], head: [string, string]): string[] {
  return [`| ${head[0]} | ${head[1]} |`, "|---|---|", ...rows.map(([a, b]) => `| ${a} | ${b} |`)];
}

const head = (repo: string, kind: string): string[] => [
  `# External code map — \`${repo}\` · ${kind}`,
  "",
];

// --- shared slice -----------------------------------------------------------

/** The provenance row for the commit the map came from.
 *
 * Three outcomes, and none of them may render as a bare empty value. Observed in practice: a tree
 * with no `.git` produced `gitCommitHash: ""` and the row rendered as an empty pair of backticks —
 * a blank where provenance belongs, with nothing saying why. Worse, a run whose hash came from a
 * DIFFERENT checkout of the same sources wrote a real-looking hash that cannot be resolved in the
 * tree that was analysed. Both mislead, so both are labelled here. */
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

function sharedSlice(
  repo: string,
  repoDir: string,
  g: Dict | null,
  s: Dict | null,
  extra: [string, string][],
): string[] {
  const L = head(repo, "orientation");
  let langs: string[] = [];
  let fws: string[] = [];
  if (g) {
    const p = (g.project as Dict) ?? {};
    L.push(
      ...table(
        [
          ["source", "`.ua/knowledge-graph.json` (complete)"],
          ["analyzed at", String(p.analyzedAt ?? "?")],
          ["git commit", commitRow(repoDir, str(p.gitCommitHash))],
          [
            "nodes / edges / layers",
            `${arr(g.nodes).length} / ${arr(g.edges).length} / ${arr(g.layers).length}`,
          ],
        ],
        ["provenance", "value"],
      ),
    );
    langs = strs(p.languages);
    fws = strs(p.frameworks);
  } else {
    const st = s ?? {};
    L.push(
      ...table(
        [
          ["source", "`.ua/intermediate/scan-result.json` (**scan only**)"],
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

function developerSlice(repo: string, g: Dict | null, s: Dict | null): string[] {
  const nodes = arr(g?.nodes);
  const edges = arr(g?.edges);
  const imports = ((s?.importMap as Dict) ?? {}) as Record<string, unknown>;
  const files = tally(nodes.filter((n) => str(n.filePath)).map((n) => str(n.filePath)));
  const importKeys = Object.keys(imports);
  if (!files.length && !edges.length && !importKeys.length) return [];
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

/** `/understand-domain` output. Nodes are three tiers — `domain` > `flow` > `step` (measured).
 *
 * Only `domain` goes in full and `flow` as a list; `step` is left out. Steps are implementation
 * detail rather than business-overview material, and that tier is half the slice. The count that
 * was left out and the path to read it are printed in the file so nothing is silently truncated. */
function productSlice(repo: string, dg: Dict): string[] {
  const nodes = arr(dg.nodes);
  const domains = nodes.filter((n) => str(n.type) === "domain");
  const flows = nodes.filter((n) => str(n.type) === "flow");
  const steps = nodes.filter((n) => str(n.type) === "step");
  if (!domains.length && !flows.length) return [];
  const graphPath = `${repo}/.ua/domain-graph.json`;
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
      const summary = str(f.summary).split(". ")[0].trim();
      return [`**${str(f.name) || "?"}**`, `${summary}${entry}`] as [string, string];
    });
    L.push(...table(rows, ["flow", "what it does"]));
    L.push("");
  }
  return L;
}

// --- main -------------------------------------------------------------------

function fail(msg: string): never {
  console.log(`❌ ${msg}`);
  process.exit(2);
}

function main(): void {
  const argv = process.argv.slice(2);
  const positional: string[] = [];
  let workspace: string | null = null;
  let space = "default";
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--workspace") workspace = argv[++i];
    else if (a === "--space") space = argv[++i];
    else if (a === "--dry-run") dryRun = true;
    else if (a.startsWith("--")) fail(`unknown flag: ${a}`);
    else positional.push(a);
  }
  if (positional.length !== 1) {
    fail("usage: ua-code-map.ts <analyzed-repo> --workspace <ws> [--space default] [--dry-run]");
  }
  const repoDir = positional[0].replace(/\/+$/, "");
  const ua = join(repoDir, ".ua");
  if (!existsSync(ua)) {
    fail(`no \`.ua/\` at ${ua} — run Understand-Anything first (installing and running it is yours)`);
  }

  let graph = load(join(ua, "knowledge-graph.json"));
  if (graph && !arr(graph.nodes).length && !arr(graph.layers).length) graph = null;
  const scan = load(join(ua, "intermediate", "scan-result.json"));
  const domain = load(join(ua, "domain-graph.json"));
  if (!graph && !scan) {
    fail(`nothing to read: ${ua} has neither knowledge-graph.json nor scan-result.json`);
  }
  const repo = basename(repoDir);

  let slices: { target: readonly [string, string]; body: string[]; why: string }[] = [];
  if (graph) {
    const body = architectSlice(repo, graph);
    if (body.length) slices.push({ target: ARCHITECT, body, why: "layer descriptions, node census" });
  }
  {
    const body = developerSlice(repo, graph, scan);
    if (body.length) {
      slices.push({ target: DEVELOPER, body, why: "hot files, relationship census, import fan-out" });
    }
  }
  if (domain) {
    const body = productSlice(repo, domain);
    if (body.length) slices.push({ target: PRODUCT, body, why: "business domains, entities, rules" });
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
    KNOWLEDGE(space, s.target[0], s.target[1]),
    s.why,
  ]);
  const written: { target: readonly [string, string]; body: string[] }[] = [
    { target: SHARED, body: sharedSlice(repo, repoDir, graph, scan, extra) },
    ...slices.map((s) => ({ target: s.target, body: s.body })),
  ];

  for (const { target, body } of written) {
    const text = body.join("\n").replace(/\n+$/, "") + "\n";
    const rel = KNOWLEDGE(space, target[0], target[1]);
    const nbytes = Buffer.byteLength(text, "utf-8");
    if (dryRun || workspace === null) {
      console.log(`  ${rel.padEnd(70)} ${String(nbytes).padStart(6)} B`);
      continue;
    }
    const out = join(workspace, rel);
    mkdirSync(dirname(out), { recursive: true });
    const same = existsSync(out) && readFileSync(out, "utf-8") === text;
    if (!same) writeFileSync(out, text, "utf-8");
    console.log(`  ${rel.padEnd(70)} ${String(nbytes).padStart(6)} B  ${same ? "unchanged" : "written"}`);
  }
  let src = graph ? "knowledge-graph.json" : "intermediate/scan-result.json";
  if (domain) src += " + domain-graph.json";
  console.log(`source: ${src}`);
  if (missing.length) {
    console.log(`🔴 slices not written — no such agent in this workspace: ${[...new Set(missing)].sort().join(", ")}`);
    console.log("   this distribution has a different persona roster — check the names and fix the mapping.");
    process.exit(1);
  }
}

main();
