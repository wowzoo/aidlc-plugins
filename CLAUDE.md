# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

A workspace for creating and maintaining your own **AI-DLC v2 plugins**. It is the **canonical authoring form** of those plugins, plus the Python drivers that apply them to an AI-DLC tree/shell and judge the result. There is no repository-wide build or test runner: plugins are verified by composing them into a **disposable copy** of a real install and inspecting the artifacts, and only the two code-map converters have unit tests (below).

- GitHub remote: `git@github.com:wowzoo/aidlc-plugins.git` (`wowzoo/aidlc-plugins`, **public**, default branch `main`). Use `gh` for GitHub operations. Anything pushed is publicly visible, so keep customer names, internal paths and credentials out of commits — including peer session names and customer folder names (e.g. a session named after a customer).
- Commit and push only when the user asks.
- `~/workspaces/platforms/aidlc/patching/aidlc-patch-workbench/plugins` is a compatibility mirror. **Never edit it directly.** Change order (from `CANONICAL.md`): edit here → validate the plugin → sync the mirror → `diff -rq` canonical vs mirror must be empty → compose dry-run in a patch staging tree.
- Verify only in scratch trees. Never modify a distributed tree's originals.
- **New plugins:** follow the `project-overview` / `ua-plugin` model. Author against the plugin tools of the release you target, ship no compose hook, and let `aidlc-plugin-build.ts` inject the bundled one. Skills and MCP entries go in `prerequisites/` with an `INSTALL.md` the AI follows after compose. A new plugin is also a new entry in `README.md`'s plugin list and `CANONICAL.md`'s asset list.

## Which tools, and where the procedures live

`README.md` owns the commands: "Which tools" defines `<tools-dir>`, "Distribute" the packaging, "Apply" the steps, and the judgement table what counts as success. Don't copy those commands here. The points that go wrong:

- `<tools-dir>` must be the plugin tools **of the release you target**: a tree of that release (`<project>/<harness>/tools`) or a checkout of its tag with generated data. **The local engine checkout `~/workspaces/platforms/aidlc/core/aidlc-workflows` is not kept on the installed release** (on 2026-11-06 it was 2.11.1-preview+23 while `aidlc` was 2.11.3). The builder copies the compose hook and the Kiro IDE hook registration from the tools it runs from, so old tools build an old hook (before 2.11.3, no `"timeout"`).
- Validate expects `VALID` with one `compose-hook-absent` warning.
- `aidlc engine plugin sync --help` prints no help: in 2.11.3 it **runs a sync** in the current folder. Run sync only inside a scratch tree.

## Distribution

- `scripts/package-plugin.py` makes one zip per harness (claude, codex, kiro-ide, kiro). Unzipped at a project root it lands in `<H>/aidlc-plugins/<p>/` with an `INSTALL.md` made from `install/<claude-code|codex|kiro>.md`.
- Nothing a plugin installs may land outside the harness directory or the user's tool config, or it can turn a project brownfield or enter the reverse-engineering/source-boundary snapshots (measured; README "Distribute"). The one exception is engine behaviour: on Codex, a plugin that adds stages puts its runners in `.agents/skills/`.
- Never name a file `install/claude.md`: on macOS it is read as that folder's `CLAUDE.md`.
- Never edit a built hook file by hand. Doctor knows a plugin hook only in a form some builder wrote (this release's, or an earlier release's untimed one); a hand re-serialised copy fails it.
- **On Kiro, the AI cannot write `.kiro/settings/**`.** Kiro CLI v3 refuses its file-write tool there (`Blocked by a permission rule … Source: kiro-scope`, measured on 3.2.0, 2026-11-11); a shell write is not refused, but that is a bypass, so never instruct it. Register an MCP server with `kiro-cli mcp add --name <n> --url <u> --scope workspace`, and when `kiro-cli` is absent (Kiro IDE only) write the file or hand the key to the person. `.kiro/hooks/*` is refused by AI-DLC's own guard, except a plugin's `aidlc-<p>-compose.json`, which an AI's `unzip … -d .` still extracts. `.kiro/skills/`, `.kiro/aidlc-plugins/` and the project root are writable.
- **Never have anyone hand-edit `.kiro/agents/aidlc*`.** From AI-DLC 2.11.1 (upstream #2535) every Kiro agent sees the MCP servers the person adds (Kiro IDE and CLI v3 through `includeMcpJson: true`; Kiro CLI V2 after one `aidlc config`, which writes the `@<server>` grants), each call asking first. A hand edit gains nothing and makes the next `aidlc config` stop on that file.
- Install docs must not call a tool the native AI-DLC install does not bring (Python, Node): check a file by reading it with `cat` and let the AI judge it (2026-11-06: on a new Mac `python3` opens the Command Line Tools dialog). Bun is the named exception: the code-map converters need it, and their `INSTALL.md` checks for it and tells the person to install it.

## AI-DLC v2 plugin mechanism reference

**Read `docs/aidlc-v2-plugin-mechanism.md` before authoring or changing a plugin.** It is checked against the engine source and covers:
- the manifest, stage, scope, agent, sensor and knowledge contracts;
- contribution merge and anchor-matching rules;
- the create/validate/build/test tools;
- compose and sync internals;
- where the official docs disagree with the code.

It records the release it was checked against (v2.11.3, re-checked 2026-11-06 against a `git archive` of the tag). When you target a later release, check a claim against that release's code before relying on it (that doc's §10 says how).

## The plugins

All six ship **no compose hook**; the builder injects the bundled hook, so `aidlc engine plugin sync` installs them.

| Plugin | Kind | Contributes | `prerequisites/` |
|---|---|---|---|
| `visual-mockups` | overlay-only (0.2.3) | prose into rough-mockups, refined-mockups, code-generation; artifacts `visual-mockups-ref`, `visual-mockups-ref-refined` | `frontend-design` skill; `INSTALL.md` fetches Figma's 3 skills and adds the `figma` MCP key |
| `codekb-mcp-plugin` | overlay-only (0.1.3) | 2 fragments into reverse-engineering, 1 into requirements-analysis, 1 into functional-design + `knowledge/aidlc-shared/codekb-mcp.md`; no tool, no artifacts | `INSTALL.md` only: adds the `code-knowledge-base` MCP key; no agent-file edit (from 2.11.1 Kiro agents see added servers; V2 needs one `aidlc config`) |
| `ua-plugin` | overlay-only (0.4.3) | 2 fragments into reverse-engineering + `tools/ua-code-map.ts` + `knowledge/aidlc-shared/external-code-map.md` | optional skill |
| `graphify-plugin` | overlay-only (0.2.2) | 2 fragments into reverse-engineering + `tools/graphify-map.ts` + `knowledge/aidlc-shared/external-code-map.md` | optional skill |
| `project-overview` | **adds stages** (0.1.2) | 4 stages (one per phase end), 1 agent, 1 knowledge file | — |
| `requirements-handoff` | **adds a scope and two stages** (0.2.2) | scope `requirements-handoff-po` (9 core stages incl. reverse-engineering, joined by `adds.scopes`), stages `requirements-handoff-prototype` and `requirements-handoff-request-form` (development request built from public forms, cited in the stage file) | — |

- Contribution frontmatter carries `plugin:` only. Compose **skips** any contribution with a `bundle:` key and records it as a drop (2.11.3: `tools/data/plugin-hooks-template/compose.ts:2746`), and the validator does not catch it.
- The validator requires every artifact a plugin **produces** to start with `<plugin>-` (`artifact-namespace`).
- Tests and fixtures go under `<plugin>/tests/`, **never** under `tools/`: the builder projects `tools/` into every install, and compose does not copy test or fixture payloads it finds there (an advisory drop). Neither the builder nor compose reads `prerequisites/` or `tests/`; `package-plugin.py` copies `prerequisites/` into the zip itself.
- **Upgrading a tree composed by the old pinned hook** (visual-mockups / graphify-plugin 0.1.0, ua-plugin 0.1.0): sync won't overwrite a file it has no record of installing, and won't remove `adds` the pinned hook wrote into stage frontmatter. Each plugin's README "Upgrading" section says what to delete or restore first, including what 0.1.0's external installer left behind.
- **`project-overview`**: the four stage files point at `knowledge/project-overview-curator-agent/overview-method.md` as the single source for the template, section ownership and merge rules. Change the method there, not in the stages.
- **`ua-plugin` and `graphify-plugin`** are multi-repo: each converter writes one file set per repo (`ua-code-map.<repo>.md`, `graphify-code-map.<repo>.md` and friends) and the two fragments brief each repo's scan and synthesis separately. Run each converter's tests with `bun test tests/` from the plugin root (synthetic repos only). ua also handles a workspace map (one `.ua/` over several repos); Graphify has no such mode.
- **`codekb-mcp-plugin`**: measured live on Kiro CLI 3.2.0 (2026-11-11, `CANONICAL.md`). Kiro v3 loads MCP tools on demand (`Tool Load`), so every condition says to look the tools up by name before deciding they are absent. "CodeKB" here is the CodeKB *service* (MCP), not AI-DLC's reverse-engineering store that is also called codekb; keep the two apart in every text. The conductor writes the run-time knowledge files (`codekb-mcp-spaces.md`, `codekb-mcp-space.<repo>.md`) itself, from what the service returned — no converter. Space Overview documents come from `get_space_overview` / `get_hyperspace_overview`, which exist on the labs instance only (2026-11-10), not upstream CodeKB 8754994; the step is conditional on them.
- **`visual-mockups`**: Figma's skills are fetched from `figma/mcp-server-guide` at install time, not shipped — the repo has no licence file. `frontend-design` is Apache-2.0 and ships with its `LICENSE.txt`.

## Contribution (overlay) format

`<plugin>/contributions/<phase>/<stage-slug>.md` has frontmatter with `target` and `plugin`, then structural `adds` (e.g. requirements-handoff's `adds.scopes`), prose fragments, or both. For a prose overlay in this repo:

- frontmatter `fragments:` is a block list, each entry an `anchor:` (`before-step:N` / `after-step:N`) with `order:` on the next line;
- one `## fragment: <anchor>` section per declared anchor, in the declared order (compose pairs by anchor label; `check-plugin-anchors.py` wants the same order);
- each fragment introduces one `### Step Nb (<plugin>): …` heading. That heading is this repo's convention, which `--post` counts; compose does not require it.

Compose wraps each fragment in `<!-- plugin:<name>:… -->` open/close sentinels. The engine accepts more anchors than this repo uses (`end-of-steps`, `in:…`, `after-preflight`, `end-of-body`); `check-plugin-anchors.py` knows only the `before-step` / `after-step` ones, so a plugin using the others needs another check.

- **An anchor means a step title, not a number.** When upstream renumbers a stage, one anchor may vanish while another still resolves but binds to the wrong step. A vanished anchor is a `[degraded]` drop: direct compose still exits 0, `aidlc engine plugin sync` rejects the result. After `--pre`, read the titles it bound to. Then read what that step does — a fragment that must feed a delegation or a write has to land before the step that performs it (visual-mockups 0.1.0's code-generation anchor resolved but landed after the delegation). Fix anchor drift in `contributions/`, never in the tree.
- Plugins wire **WHERE/WHEN** only. Rules for *how* to treat a code map live in `external-code-map.md` under `aidlc-shared/` knowledge (each code-map plugin ships its own), and how to drive Figma lives in the Figma skills. Don't restate those rules in fragments.
- Every code-map fragment is conditional: with no finished map present, it tells the agent to skip and scan as stock.

## Apply and verify

The procedure and the judgement table are in `README.md` ("Apply", "Judgement table"). What to keep in mind:

- Sync is a transaction: every selected plugin composes in a staging copy, and one `[degraded]` drop rejects the staged result before anything is committed. Read its error line; judge the rest by artifacts (`--post`, drops = 0, `stage-graph.json` delta, `doctor` count unchanged).
- `aidlc doctor` may write runtime state (session and audit records) where it runs; run from a folder with no `aidlc/`, it created `aidlc/.aidlc-sessions/` there. Run it only inside the scratch tree.
- `--post` checks plugin-owned headings = fragment count and sentinels = 2 × fragments. Never gate on total heading counts, because that is upstream's numbering.
- Quick self-checks used in `CANONICAL.md`: every manifest parses as JSON, `python -m py_compile scripts/*.py`, every plugin validates `VALID`.

## Composition rules

- `ua-plugin` and `graphify-plugin` are **alternatives**: same anchor, same stage, different tool. Compose exactly one into a tree. Compose doesn't enforce this; both plugins' `prerequisites/INSTALL.md` stop on a tree that has both. `visual-mockups` combines with either.
- Plugins are applied on demand after the patch tree is built. They are not a permanent layer of the distributed tree, so a committed tree does not carry them.
- The seam can't ship skills, MCP servers, memory, or root files. Valid `contributes` keys are `stages · overlays · agents · scopes · sensors · knowledge · tools` (`memory` is listed in the engine but refused by the validator). Rules files ship through `knowledge`; skills and MCP entries sit in `<plugin>/prerequisites/` with an `INSTALL.md` the AI follows after the plugin is composed (decided for ua-plugin 2026-10-21, extended to visual-mockups and graphify-plugin 2026-10-26).
- The MCP merge drivers serve the distribution build, not a plugin install. The Kiro driver copies each source entry verbatim, so the `"disabled": true` that both the stock Kiro registry and our source registry carry stays; the claude driver drops the `disabled` key, since claude's `.mcp.json` has none. `apply-mcp-registry-policy.py` is a distribution policy (narrows the registry to `KEEP`) and has to be re-run after every rebuild. A plugin install follows its `INSTALL.md` instead: visual-mockups adds `figma` with no `disabled` key.

## Converters (`*/tools/*.ts`, run with bun)

```bash
bun <harness>/tools/ua-code-map.ts   <analyzed-repo> --workspace <ws> [--space default] [--dry-run]
bun <harness>/tools/graphify-map.ts  <analyzed-repo> --workspace <ws> [--space default] [--dry-run]
```
Both write provenance and facts only, split per agent: a small orientation file in `aidlc-shared/` (inline stages read it on every run), and the bulky slices under the owning agent's knowledge dir, so the bulky detail is not repeated in the shared file. The schema notes in the file headers and in `graphify-plugin/README.md` were measured from real tool output. Examples: Graphify's edge array is `links`, `built_at_commit` is top-level, and communities are unnamed. Keep it that way: don't invent summaries or names the tool didn't produce.
