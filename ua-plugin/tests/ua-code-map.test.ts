// Converter tests. Run from the plugin root: `bun test tests/`.
// Every fixture is synthetic and built in a temp dir; no real map is read.
import { afterAll, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TOOL = join(dirname(fileURLToPath(import.meta.url)), "..", "tools", "ua-code-map.ts");
const root = mkdtempSync(join(tmpdir(), "ua-code-map-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

const AGENTS = ["aidlc-developer-agent", "aidlc-architect-agent", "aidlc-product-agent"];

function git(dir: string, ...args: string[]): string {
  const r = spawnSync("git", ["-C", dir, "-c", "user.email=t@example.com", "-c", "user.name=t", ...args], {
    encoding: "utf-8",
  });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
}

function workspace(name: string): string {
  const ws = join(root, name);
  mkdirSync(join(ws, ".claude", "agents"), { recursive: true });
  for (const a of AGENTS) writeFileSync(join(ws, ".claude", "agents", `${a}.md`), `# ${a}\n`);
  return ws;
}

/** A sibling repo with a finished map recorded at its current HEAD. */
function repo(ws: string, name: string, opts: { tags?: string[]; guide?: boolean; mode?: number } = {}): string {
  const dir = join(ws, name);
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, "src", "a.ts"), "export const a = 1;\n");
  git(dir, "init", "-q");
  git(dir, "add", ".");
  git(dir, "commit", "-q", "-m", "init");
  const hash = git(dir, "rev-parse", "HEAD");
  const ua = join(dir, ".ua");
  mkdirSync(ua, { recursive: true });
  const graph = {
    version: "1.0.0",
    project: {
      name,
      languages: ["typescript"],
      frameworks: [],
      description: "",
      analyzedAt: "2026-01-01T00:00:00Z",
      gitCommitHash: hash,
    },
    nodes: [
      { id: "file:src/a.ts", type: "file", name: "a.ts", filePath: "src/a.ts", summary: "", tags: opts.tags ?? [], complexity: "simple" },
    ],
    edges: [{ source: "file:src/a.ts", target: "file:src/a.ts", type: "imports", weight: 1 }],
    layers: [{ id: "l1", name: `${name} core`, description: "core layer", nodeIds: ["file:src/a.ts"] }],
    tour: [{ order: 1, title: `Start in ${name}`, description: "", nodeIds: ["file:src/a.ts"] }],
  };
  const graphPath = join(ua, "knowledge-graph.json");
  writeFileSync(graphPath, JSON.stringify(graph));
  if (opts.mode !== undefined) spawnSync("chmod", [opts.mode.toString(8), graphPath]);
  writeFileSync(join(ua, "meta.json"), JSON.stringify({ lastAnalyzedAt: "2026-01-01T00:00:00Z", gitCommitHash: hash, version: "1.0.0", analyzedFiles: 1 }));
  writeFileSync(
    join(ua, "domain-graph.json"),
    JSON.stringify({
      nodes: [
        { id: "domain:d", type: "domain", name: `${name} domain`, summary: "s", domainMeta: { entities: ["E"] } },
        { id: "flow:f", type: "flow", name: "flow", summary: "does it. more", domainMeta: { entryPoint: "src/a.ts", entryType: "http" } },
        { id: "step:s", type: "step", name: "step", summary: "" },
      ],
      edges: [],
    }),
  );
  if (opts.guide) writeFileSync(join(ua, "GUIDE.md"), "# guide\n");
  return dir;
}

function run(...args: string[]) {
  return spawnSync("bun", [TOOL, ...args], { encoding: "utf-8" });
}

const K = (ws: string, owner: string, file: string) => join(ws, "aidlc", "spaces", "s1", "knowledge", owner, file);

test("two repos convert side by side, each under its own name", () => {
  const ws = workspace("multi");
  const app = repo(ws, "app");
  const appWeb = repo(ws, "app-web", { tags: ["db-routine:SP_A", "db-routine:SP_B", "plain"], guide: true });
  const r = run(app, appWeb, "--workspace", ws, "--space", "s1");
  expect(r.status).toBe(0);
  for (const name of ["app", "app-web"]) {
    const shared = readFileSync(K(ws, "aidlc-shared", `ua-code-map.${name}.md`), "utf-8");
    expect(shared.split("\n")[0]).toBe(`# External code map — \`${name}\` · orientation`);
    expect(shared).toContain("map commit is HEAD");
    expect(existsSync(K(ws, "aidlc-developer-agent", `ua-structure.${name}.md`))).toBe(true);
    expect(existsSync(K(ws, "aidlc-architect-agent", `ua-architecture.${name}.md`))).toBe(true);
    expect(existsSync(K(ws, "aidlc-product-agent", `ua-domains.${name}.md`))).toBe(true);
  }
  // No fixed, repo-less names any more.
  expect(existsSync(K(ws, "aidlc-shared", "ua-code-map.md"))).toBe(false);
  // Facts the run left: guides by path, tag prefixes by count.
  expect(readFileSync(K(ws, "aidlc-shared", "ua-code-map.app-web.md"), "utf-8")).toContain("`app-web/.ua/GUIDE.md`");
  expect(readFileSync(K(ws, "aidlc-developer-agent", "ua-structure.app-web.md"), "utf-8")).toContain("| `db-routine:` | 2 |");
  expect(readFileSync(K(ws, "aidlc-developer-agent", "ua-structure.app.md"), "utf-8")).not.toContain("Tag prefixes");
});

test("re-converting one repo leaves the other repo's files untouched", () => {
  const ws = workspace("rerun");
  const a = repo(ws, "a");
  const b = repo(ws, "b");
  expect(run(a, b, "--workspace", ws, "--space", "s1").status).toBe(0);
  const before = readFileSync(K(ws, "aidlc-shared", "ua-code-map.b.md"), "utf-8");
  const r = run(a, "--workspace", ws, "--space", "s1");
  expect(r.status).toBe(0);
  expect(r.stdout).toContain("unchanged");
  expect(readFileSync(K(ws, "aidlc-shared", "ua-code-map.b.md"), "utf-8")).toBe(before);
});

test("a map older than HEAD is marked stale", () => {
  const ws = workspace("stale");
  const dir = repo(ws, "svc");
  writeFileSync(join(dir, "src", "b.ts"), "export const b = 2;\n");
  git(dir, "add", "src");
  git(dir, "commit", "-q", "-m", "more");
  expect(run(dir, "--workspace", ws, "--space", "s1").status).toBe(0);
  expect(readFileSync(K(ws, "aidlc-shared", "ua-code-map.svc.md"), "utf-8")).toContain("**stale**");
});

test("an owner-only map produces owner-only knowledge files", () => {
  const ws = workspace("private");
  const dir = repo(ws, "secret", { mode: 0o600 });
  expect(run(dir, "--workspace", ws, "--space", "s1").status).toBe(0);
  expect(statSync(K(ws, "aidlc-shared", "ua-code-map.secret.md")).mode & 0o777).toBe(0o600);
});

test("files from the single-repo converter are named, not deleted", () => {
  const ws = workspace("legacy");
  const dir = repo(ws, "old");
  const legacy = K(ws, "aidlc-shared", "ua-code-map.md");
  mkdirSync(dirname(legacy), { recursive: true });
  writeFileSync(legacy, "# External code map — `old` · orientation\n");
  const r = run(dir, "--workspace", ws, "--space", "s1");
  expect(r.status).toBe(0);
  expect(r.stdout).toContain("aidlc/spaces/s1/knowledge/aidlc-shared/ua-code-map.md");
  expect(existsSync(legacy)).toBe(true);
});

test("a long flow summary is cut and marked, a pipe cannot break the row", () => {
  const ws = workspace("flows");
  const dir = repo(ws, "f");
  const dg = join(dir, ".ua", "domain-graph.json");
  const g = JSON.parse(readFileSync(dg, "utf-8"));
  g.nodes[1].summary = `a|b ${"x".repeat(400)}`;
  writeFileSync(dg, JSON.stringify(g));
  expect(run(dir, "--workspace", ws, "--space", "s1").status).toBe(0);
  const row = readFileSync(K(ws, "aidlc-product-agent", "ua-domains.f.md"), "utf-8")
    .split("\n")
    .find((l) => l.startsWith("| **flow**"));
  expect(row).toContain("a\\|b ");
  expect(row).toContain("…");
  expect(row?.length ?? 0).toBeLessThan(260);
});

test("two trees with the same repo name are refused", () => {
  const ws = workspace("dup");
  const one = repo(ws, "same");
  const other = repo(workspace("dup2"), "same");
  const r = run(one, other, "--workspace", ws, "--space", "s1");
  expect(r.status).toBe(2);
  expect(r.stdout).toContain("share the repo name");
});

test("a missing agent is reported and the run exits 1", () => {
  const ws = workspace("roster");
  rmSync(join(ws, ".claude", "agents", "aidlc-product-agent.md"));
  const dir = repo(ws, "r");
  const r = run(dir, "--workspace", ws, "--space", "s1");
  expect(r.status).toBe(1);
  expect(r.stdout).toContain("aidlc-product-agent");
  expect(existsSync(K(ws, "aidlc-product-agent", "ua-domains.r.md"))).toBe(false);
});

/** A folder (not a git checkout) holding two repos, mapped once at the folder: node paths start with
 * the repo name. One import edge crosses from `core` into `web`. */
function workspaceMap(ws: string): string {
  for (const r of ["core", "web"]) {
    const dir = join(ws, r);
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", "x.ts"), "export const x = 1;\n");
    git(dir, "init", "-q");
    git(dir, "add", ".");
    git(dir, "commit", "-q", "-m", "init");
  }
  const ua = join(ws, ".ua");
  mkdirSync(ua, { recursive: true });
  const node = (r: string) => ({ id: `file:${r}/src/x.ts`, type: "file", name: "x.ts", filePath: `${r}/src/x.ts`, summary: "", tags: [], complexity: "simple" });
  writeFileSync(
    join(ua, "knowledge-graph.json"),
    JSON.stringify({
      version: "1.0.0",
      project: { name: "ws", languages: ["typescript"], frameworks: [], description: "", analyzedAt: "2026-01-01T00:00:00Z", gitCommitHash: "" },
      nodes: [node("core"), node("web"), { id: "function:core/src/x.ts:run", type: "function", name: "run", summary: "", tags: [], complexity: "simple" }],
      edges: [
        { source: "file:core/src/x.ts", target: "file:web/src/x.ts", type: "imports", weight: 1 },
        { source: "file:core/src/x.ts", target: "function:core/src/x.ts:run", type: "contains", weight: 1 },
      ],
      layers: [{ id: "l", name: "all", description: "both", nodeIds: ["file:core/src/x.ts", "file:web/src/x.ts"] }],
      tour: [{ order: 1, title: "web first", description: "", nodeIds: ["file:web/src/x.ts"] }],
    }),
  );
  writeFileSync(join(ua, "meta.json"), JSON.stringify({ lastAnalyzedAt: "2026-01-01T00:00:00Z", gitCommitHash: "", version: "1.0.0", analyzedFiles: 2 }));
  writeFileSync(
    join(ua, "domain-graph.json"),
    JSON.stringify({
      nodes: [
        { id: "domain:d1", type: "domain", name: "Billing", summary: "s" },
        { id: "flow:f1", type: "flow", name: "charge", summary: "charges." },
        { id: "step:s1", type: "step", name: "s", summary: "", filePath: "web/src/x.ts" },
      ],
      edges: [
        { source: "domain:d1", target: "flow:f1", type: "contains_flow" },
        { source: "flow:f1", target: "step:s1", type: "flow_step" },
      ],
    }),
  );
  return ws;
}

test("a workspace map is split per repo, with the edges that cross repos", () => {
  const ws = workspaceMap(workspace("wsmap"));
  const r = run(ws, "--workspace", ws, "--space", "s1");
  expect(r.status).toBe(0);
  expect(r.stdout).toContain("workspace map:");
  for (const name of ["core", "web"]) {
    const shared = readFileSync(K(ws, "aidlc-shared", `ua-code-map.${name}.md`), "utf-8");
    expect(shared).toContain("**workspace map**");
    expect(shared).toContain("not recorded");
  }
  expect(readFileSync(K(ws, "aidlc-shared", "ua-code-map.core.md"), "utf-8")).toContain("2 of 3 nodes");
  const core = readFileSync(K(ws, "aidlc-developer-agent", "ua-structure.core.md"), "utf-8");
  expect(core).toContain("| → web · imports | 1 |");
  expect(readFileSync(K(ws, "aidlc-developer-agent", "ua-structure.web.md"), "utf-8")).toContain("| ← core · imports | 1 |");
  // The domain follows its step's file: Billing is web's, not core's.
  expect(readFileSync(K(ws, "aidlc-product-agent", "ua-domains.web.md"), "utf-8")).toContain("## Billing");
  expect(existsSync(K(ws, "aidlc-product-agent", "ua-domains.core.md"))).toBe(false);
});

test("recorded heads anchor a workspace map's freshness per repo", () => {
  const ws = workspaceMap(workspace("wsheads"));
  expect(run("--record-heads", ws).status).toBe(0);
  expect(existsSync(join(ws, ".ua", "repo-heads.json"))).toBe(true);
  writeFileSync(join(ws, "web", "src", "y.ts"), "export const y = 2;\n");
  git(join(ws, "web"), "add", ".");
  git(join(ws, "web"), "commit", "-q", "-m", "more");
  expect(run(ws, "--workspace", ws, "--space", "s1").status).toBe(0);
  expect(readFileSync(K(ws, "aidlc-shared", "ua-code-map.core.md"), "utf-8")).toContain("map commit is HEAD");
  expect(readFileSync(K(ws, "aidlc-shared", "ua-code-map.web.md"), "utf-8")).toContain("**stale**");
});
