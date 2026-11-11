// Converter tests. Run from the plugin root: `bun test tests/`.
// Every fixture is synthetic and built in a temp dir; no real map is read.
import { afterAll, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TOOL = join(dirname(fileURLToPath(import.meta.url)), "..", "tools", "graphify-map.ts");
const root = mkdtempSync(join(tmpdir(), "graphify-map-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

const AGENTS = ["aidlc-developer-agent", "aidlc-architect-agent", "aidlc-product-agent"];

function git(dir: string, ...args: string[]): string {
  const r = spawnSync("git", ["-C", dir, "-c", "user.email=t@example.com", "-c", "user.name=t", ...args], {
    encoding: "utf-8",
  });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
}

function workspace(name: string, agents = AGENTS): string {
  const ws = join(root, name);
  mkdirSync(join(ws, ".claude", "agents"), { recursive: true });
  for (const a of agents) writeFileSync(join(ws, ".claude", "agents", `${a}.md`), `# ${a}\n`);
  return ws;
}

/** A sibling repo with a finished map. `commit: "head"` records the repo's HEAD, `"old"` a commit
 * that is no longer HEAD, `"none"` no commit at all. */
function repo(
  ws: string,
  name: string,
  opts: { commit?: "head" | "old" | "none"; documents?: boolean; git?: boolean } = {},
): string {
  const dir = join(ws, name);
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, "src", "a.ts"), "export const a = 1;\n");
  let hash = "";
  if (opts.git !== false) {
    git(dir, "init", "-q");
    git(dir, "add", ".");
    git(dir, "commit", "-q", "-m", "init");
    hash = git(dir, "rev-parse", "HEAD");
    if (opts.commit === "old") {
      writeFileSync(join(dir, "src", "b.ts"), "export const b = 2;\n");
      git(dir, "add", ".");
      git(dir, "commit", "-q", "-m", "next");
    }
  }
  const nodes = [
    { id: "a", label: `${name}A`, file_type: "code", source_file: "src/a.ts", community: 0 },
    { id: "b", label: `${name}B`, file_type: "code", source_file: "src/b.ts", community: 1 },
  ];
  if (opts.documents) nodes.push({ id: "d", label: "Design note", file_type: "document", source_file: "docs/d.md", community: 1 });
  const graph: Record<string, unknown> = {
    directed: true,
    multigraph: false,
    graph: {},
    nodes,
    links: [
      { source: "a", target: "b", relation: "imports", confidence: "EXTRACTED", source_file: "src/a.ts" },
      { source: "b", target: "a", relation: "calls", confidence: "INFERRED", confidence_score: 0.7, source_file: "src/b.ts", source_location: "L3" },
    ],
    hyperedges: [],
  };
  if ((opts.commit ?? "head") !== "none" && hash) graph.built_at_commit = hash;
  mkdirSync(join(dir, "graphify-out"), { recursive: true });
  writeFileSync(join(dir, "graphify-out", "graph.json"), JSON.stringify(graph));
  return dir;
}

function run(...args: string[]) {
  return spawnSync("bun", [TOOL, ...args], { encoding: "utf-8" });
}

const K = (ws: string, owner: string, name: string) => join(ws, "aidlc", "spaces", "s1", "knowledge", owner, name);

test("each repo gets its own set of files, named and headed by the repo", () => {
  const ws = workspace("two");
  const a = repo(ws, "app");
  const b = repo(ws, "app-web");
  const r = run(a, b, "--workspace", ws, "--space", "s1");
  expect(r.status).toBe(0);
  for (const name of ["app", "app-web"]) {
    const shared = K(ws, "aidlc-shared", `graphify-code-map.${name}.md`);
    expect(readFileSync(shared, "utf-8").split("\n", 1)[0]).toBe(`# External code map — \`${name}\` · orientation`);
    expect(readFileSync(K(ws, "aidlc-architect-agent", `graphify-architecture.${name}.md`), "utf-8")).toContain(`\`${name}\` · architecture`);
    expect(readFileSync(K(ws, "aidlc-developer-agent", `graphify-structure.${name}.md`), "utf-8")).toContain(`${name}A`);
  }
  // No fixed-name file is written any more.
  expect(existsSync(K(ws, "aidlc-shared", "graphify-code-map.md"))).toBe(false);
});

test("converting one repo leaves another repo's files alone", () => {
  const ws = workspace("alone");
  const a = repo(ws, "one");
  const b = repo(ws, "two");
  expect(run(a, b, "--workspace", ws, "--space", "s1").status).toBe(0);
  const other = K(ws, "aidlc-developer-agent", "graphify-structure.two.md");
  const before = readFileSync(other, "utf-8");
  writeFileSync(join(a, "graphify-out", "graph.json"), readFileSync(join(a, "graphify-out", "graph.json"), "utf-8").replace("oneA", "oneRenamed"));
  const r = run(a, "--workspace", ws, "--space", "s1");
  expect(r.status).toBe(0);
  expect(readFileSync(K(ws, "aidlc-developer-agent", "graphify-structure.one.md"), "utf-8")).toContain("oneRenamed");
  expect(readFileSync(other, "utf-8")).toBe(before);
});

test("two trees with the same directory name are refused, nothing written", () => {
  const ws = workspace("dup");
  const a = repo(ws, "svc");
  mkdirSync(join(ws, "other"), { recursive: true });
  const b = repo(join(ws, "other"), "svc");
  const r = run(a, b, "--workspace", ws, "--space", "s1");
  expect(r.status).toBe(2);
  expect(r.stdout).toContain("share the repo name `svc`");
  expect(existsSync(K(ws, "aidlc-shared", "graphify-code-map.svc.md"))).toBe(false);
});

test("freshness: current, stale, and no commit recorded", () => {
  const ws = workspace("fresh");
  const cur = repo(ws, "cur");
  const old = repo(ws, "old", { commit: "old" });
  const none = repo(ws, "none", { git: false });
  expect(run(cur, old, none, "--workspace", ws, "--space", "s1").status).toBe(0);
  expect(readFileSync(K(ws, "aidlc-shared", "graphify-code-map.cur.md"), "utf-8")).toContain("map commit is HEAD");
  expect(readFileSync(K(ws, "aidlc-shared", "graphify-code-map.old.md"), "utf-8")).toContain("**stale**");
  expect(readFileSync(K(ws, "aidlc-shared", "graphify-code-map.none.md"), "utf-8")).toContain("unknown — the map records no commit");
});

test("the documents slice appears only when the map has non-code nodes", () => {
  const ws = workspace("docs");
  const plain = repo(ws, "plain");
  const withDocs = repo(ws, "withdocs", { documents: true });
  expect(run(plain, withDocs, "--workspace", ws, "--space", "s1").status).toBe(0);
  expect(existsSync(K(ws, "aidlc-product-agent", "graphify-documents.plain.md"))).toBe(false);
  expect(readFileSync(K(ws, "aidlc-product-agent", "graphify-documents.withdocs.md"), "utf-8")).toContain("Design note");
});

test("0.1.0 fixed-name files are named, not deleted", () => {
  const ws = workspace("legacy");
  const a = repo(ws, "app");
  const legacy = K(ws, "aidlc-shared", "graphify-code-map.md");
  mkdirSync(dirname(legacy), { recursive: true });
  writeFileSync(legacy, "# External code map — `app` · orientation\n");
  const r = run(a, "--workspace", ws, "--space", "s1");
  expect(r.status).toBe(0);
  expect(r.stdout).toContain("graphify-plugin 0.1.0");
  expect(r.stdout).toContain("aidlc/spaces/s1/knowledge/aidlc-shared/graphify-code-map.md");
  expect(existsSync(legacy)).toBe(true);
});

test("a slice whose agent is not in the roster is skipped and the run exits 1", () => {
  const ws = workspace("roster", ["aidlc-developer-agent"]);
  const a = repo(ws, "app");
  const r = run(a, "--workspace", ws, "--space", "s1");
  expect(r.status).toBe(1);
  expect(r.stdout).toContain("aidlc-architect-agent");
  expect(existsSync(K(ws, "aidlc-developer-agent", "graphify-structure.app.md"))).toBe(true);
  expect(existsSync(K(ws, "aidlc-architect-agent", "graphify-architecture.app.md"))).toBe(false);
});

test("a second run with no change reports every file unchanged", () => {
  const ws = workspace("idem");
  const a = repo(ws, "app");
  expect(run(a, "--workspace", ws, "--space", "s1").status).toBe(0);
  const r = run(a, "--workspace", ws, "--space", "s1");
  expect(r.status).toBe(0);
  expect(r.stdout).not.toContain("written");
  expect(r.stdout).toContain("unchanged");
});

test("an unfinished map (no graph.json) is refused", () => {
  const ws = workspace("unfinished");
  const dir = join(ws, "half");
  mkdirSync(join(dir, "graphify-out", "cache"), { recursive: true });
  const r = run(dir, "--workspace", ws, "--space", "s1");
  expect(r.status).toBe(2);
  expect(r.stdout).toContain("mid-build");
});
