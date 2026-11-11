# aidlc-plugins — authoring form and apply procedure

The authoring form of six AI-DLC plugins, plus the drivers that judge the result
of putting them on a tree or shell.

```
visual-mockups/     gives the mockup stages a visual surface and carries the mockup into code
ua-plugin/          lets reverse-engineering use an external structural map as an index — Understand-Anything
graphify-plugin/    the same seam for Graphify — an ALTERNATIVE to ua-plugin, not a layer on it
codekb-mcp-plugin/  the CodeKB service (MCP `code-knowledge-base`) as an index at reverse-engineering and for impact at requirements-analysis and functional-design
project-overview/   a stage at the end of each phase that keeps one cumulative project overview per space
requirements-handoff/ a no-code scope for a product owner: requirements, screen design and a clickable wireframe for a delivery team
install/            the INSTALL.md each packaged zip carries, one per tool (Claude Code, Codex, Kiro)
scripts/            packaging, judgement and MCP registry drivers
```

All six ship **no compose hook** and are built and tested with the plugin tools of the release
they target (see "Which tools"); the builder injects the bundled hook, so
`aidlc engine plugin sync` installs them. `visual-mockups` 0.1.0 and
`graphify-plugin` 0.1.0 carried a pinned older hook that sync refuses; their
READMEs say how to upgrade a tree that has them.

🔴🔴 **`ua-plugin` and `graphify-plugin` are alternatives.** They contribute the same anchor of the
same stage for two different tools, so a tree carrying both hands the Developer two indexes with two
provenance chains. **Compose exactly one of them into a tree.** Nothing in compose enforces it —
each owns its own sentinel — but both `prerequisites/INSTALL.md` procedures stop on a tree that
carries the other.

| Driver | What it does |
|---|---|
| `scripts/package-plugin.py` | builds one zip per harness — projection, `prerequisites/` and the matching `install/` doc as `INSTALL.md` (see "Distribute") |
| `scripts/check-plugin-anchors.py` | `--pre` every declared anchor resolves in the compose base · `--post` every fragment actually landed |
| `scripts/merge-mcp-registry-kiro.py` | union-merges MCP entries into `.kiro/settings/mcp.json`, never overriding a stock key; copies each source block verbatim, so its `"disabled": true` (both the stock and our source registry carry it) stays |
| `scripts/merge-mcp-registry-claude.py` | the same for a claude tree's root `.mcp.json`, dropping the `disabled` key |
| `scripts/apply-mcp-registry-policy.py` | narrows the merged registry to a chosen server set and adds the `context7` header |

The MCP drivers serve the distribution build. A person installing `visual-mockups` gets the `figma`
entry from its `INSTALL.md` instead.

A plugin here is **not** a layer of the distributed tree — it is applied on
demand, so a committed tree does not carry one. The tradeoff is explicit: when a
plugin was a layer, that layer's `spec/manifest.json` pinned the apply result as
a sha map, so "spec output == compose output" was proved mechanically. That proof
is gone; apply is now judged by running the table below. What is gained is that
the plugin is a choice rather than a property of the tree.

---

## Which tools — `<tools-dir>`

Every command below that runs `bun <tools-dir>/aidlc-plugin-*.ts` needs the plugin tools **of the
release you target**: a tree of that release (`<project>/<harness>/tools`, e.g. one made with
`aidlc config` by that `aidlc` binary), or a checkout of that release's tag with its generated data
(`plugin-targets.json`, `data/plugin-hooks-template/`). The builder copies the compose hook and the
Kiro IDE hook registration from wherever it runs, so older tools build an older hook (before 2.11.3,
no `"timeout"`). **Do not assume a local engine checkout matches the installed `aidlc`**: check
`aidlc --version` against the tools' release.

---

## Distribute — a zip per tool, one prompt to install

AI-DLC has no command a person types to install a plugin. Package each plugin as one zip per tool;
the person unzips it at the project root and gives the AI one line.

```bash
uv run python scripts/package-plugin.py --tools <tools-dir> \
  --out <dir outside this repo> visual-mockups ua-plugin graphify-plugin codekb-mcp-plugin project-overview requirements-handoff
```

| Zip | Lands at | The person tells the AI |
|---|---|---|
| `aidlc-<p>-<v>-claude.zip` | `.claude/aidlc-plugins/<p>/` | `Read .claude/aidlc-plugins/<p>/INSTALL.md to the end and follow it.` |
| `aidlc-<p>-<v>-codex.zip` | `.codex/aidlc-plugins/<p>/` | `Read .codex/aidlc-plugins/<p>/INSTALL.md to the end and follow it.` |
| `aidlc-<p>-<v>-kiro-ide.zip` — Kiro IDE, and Kiro CLI on its v3 engine | `.kiro/aidlc-plugins/<p>/` + `.kiro/hooks/aidlc-<p>-compose.json` | `Read .kiro/aidlc-plugins/<p>/INSTALL.md to the end and follow it.` |
| `aidlc-<p>-<v>-kiro.zip` — Kiro CLI on its V2 engine | `.kiro/aidlc-plugins/<p>/` | same |

The suffix is the AI-DLC harness, not the tool: `kiro-ide` serves Kiro IDE and Kiro CLI v3. For a
distribution that ships one harness only, `--harness <h> --plain-name` names the zip
`aidlc-<p>-<v>.zip`; its INSTALL.md names that file.

The three tools install differently, and `install/` holds one procedure for each:

| | Claude Code (`install/claude-code.md`) | Codex (`install/codex.md`) | Kiro: `kiro-ide` and `kiro` harnesses (`install/kiro.md`) |
|---|---|---|---|
| install | copy to `<config>/aidlc-plugins/<p>/`, local marketplace, `claude plugin install --scope local` | copy to `$CODEX_HOME/aidlc-plugins/<p>/`, `codex plugin add` — **for the user, every project** | none — the plugin stays in `.kiro/aidlc-plugins/<p>/` |
| compose | the AI runs `aidlc engine plugin sync`; the plugin's SessionStart hook after that | same; plugin hooks run in interactive `codex`, not in `codex exec` | the AI runs sync with `AIDLC_PLUGIN_ROOT`; Kiro IDE's compose hook after that, Kiro CLI has none |
| skills / MCP | `.claude/skills/` · `claude mcp add --scope local` | `$CODEX_HOME/skills/` · `.codex/config.toml` | `.kiro/skills/` · `.kiro/settings/mcp.json` |
| unzipped folder afterwards | deletable | deletable | **keep** |

🔴 **Nothing may land outside the harness directory or the user's tool config.** Measured on 2.11.2:
a folder at the project root with a `tests/` directory or a `.ts` file turns a new project
brownfield; a server in the project's `.mcp.json` and a skill in `.agents/skills/` enter the source
boundary. With the placements above, project type, the CodeKB source snapshot and the source
boundary stay unchanged on all four harnesses, and an AI following only `INSTALL.md` installed
`visual-mockups` + `ua-plugin` end to end on Claude Code, Codex and Kiro CLI. The one exception is
engine behaviour: on Codex, a plugin that adds stages puts its runners in `.agents/skills/`, which
enter the source boundary exactly as AI-DLC's own runners do.

---

## Apply — once per plugin (development)

```bash
TOOLS=<tools-dir>      # see "Which tools"
TARGET=<project root>
HD=.kiro            # .claude for a claude tree

# 1. 🔴 PRE-FLIGHT — measure that anchors resolve AND bind to the intended step
uv run python scripts/check-plugin-anchors.py --pre "$TARGET" --plugin-root <plugin>
#    🔴🔴 "resolved" is not "bound correctly" — **read the titles.** A stage that drops
#    a step renumbers everything after it: one anchor then vanishes (and would be
#    dropped) while another survives and binds to the wrong step. The silent one is
#    worse. ⇒ **an anchor means a title, not a number.** (A vanished anchor is a
#    `[degraded]` drop: direct compose still exits 0, sync rejects the result.)
#    On exit 1 the fix belongs in the authoring form (`<plugin>/contributions/`),
#    not in the tree.

# 2. Validate and build the projection for the harness
bun $TOOLS/aidlc-plugin-validate.ts <plugin>          # VALID, one compose-hook-absent warning
bun $TOOLS/aidlc-plugin-build.ts    <plugin> <harness> <out>   # claude, kiro-ide, kiro, codex, …

# 3. Install the projection the host's way and sync — the steps in install/<tool>.md
#    (Claude Code / Codex: local marketplace + install, then sync; Kiro: drop the
#    projection's .kiro folder into the project, then)
aidlc engine plugin sync --harness-dir .kiro --plugin-root ./.kiro/aidlc-plugins/<plugin>
#    🔴 `aidlc engine plugin sync --help` prints no help: it RUNS a sync in the current
#    folder (2.11.3 reads no help flag). Run sync only inside the scratch tree.

# 4. Prerequisites the seam cannot carry — tell the AI:
#    "Read <plugin>/prerequisites/INSTALL.md to the end and follow it."
#    (visual-mockups, ua-plugin, graphify-plugin, codekb-mcp-plugin; project-overview and requirements-handoff have none)

# 5. 🔴 Judge by the artifact — exit code is not a judgement
uv run python scripts/check-plugin-anchors.py --post "$TARGET" --plugin-root <plugin>
```

- **Sync is a transaction.** Every selected plugin composes in a staging copy first; one
  `[degraded]` drop rejects the staged result before anything is committed, and the drops file is
  thrown away with the staging copy — read the sync's own error line.
- **A file sync has no record of installing is never overwritten.** That is how an older plugin
  version's tool, composed by the pinned hook, blocks the first sync of the new one; the plugin's
  README names the file to delete.
- `bun $TOOLS/aidlc-plugin-test.ts <plugin> --install <project-root> --harness <harness>` runs the
  same build and compose in a staging copy (drops, graph compile, idempotent second compose) and
  leaves the install untouched.

### Prerequisites ship in `prerequisites/`

🔴 **The seam can ship neither skills nor MCP servers.** The valid
`aidlc.contributes` keys are `stages · overlays · agents · scopes · sensors ·
knowledge · tools`, and `memory` is refused by the validator. Rules files go through
`knowledge`. What is left — skills, and for `visual-mockups` the `figma` MCP entry —
sits in each plugin's `prerequisites/` with an `INSTALL.md` the AI follows **after**
the plugin is composed. Neither the builder nor compose reads `prerequisites/`.

| Plugin | `prerequisites/` holds | Fetched instead of shipped |
|---|---|---|
| `visual-mockups` | `frontend-design` (Apache-2.0, `LICENSE.txt`) | Figma's three skills, from `figma/mcp-server-guide` (no licence file) |
| `ua-plugin` | `aidlc-external-code-map` (optional) | — |
| `graphify-plugin` | `aidlc-graphify-code-map` (optional) | — |

⭐ **No procedure touches an always-on instruction file.** `AGENTS.md` and `CLAUDE.md`
stay byte-identical to stock: a pointer there is read by every stage, while a
skill's own `description` costs nothing. The trade-off is deliberate — a user who
never mentions a code map is never told the wiring exists, the same way
`visual-mockups` waits to be asked.

## 🔴 Judgement table — do not trust exit 0

| Item | How to measure | Expected |
|---|---|---|
| stage count unchanged | `stage-graph.json` array length · slug set | both unchanged for the three overlay-only plugins |
| prose splice landed | `check-plugin-anchors.py --post` | per file, **sentinels = fragments×2** (open+close) · **`### Step Nb` headings owned by the plugin = fragment count**. 🔴**Never gate on the total heading count** — that is the host stage's own numbering and upstream moves it (a hardcoded value produces false FAILs) |
| drops | sync's exit and error line · `find "$TARGET" -name '*.drops'` | sync `complete`, **0** drops files |
| visual-mockups seam | `produces`/`consumes` delta | `rough` produces += `visual-mockups-ref` · `refined` produces += `visual-mockups-ref-refined`, consumes += `visual-mockups-ref` · `code-generation` consumes += both plus `mockups`, `wireframes`, all optional. No `mockup-visual-ref` left anywhere (0.1.0's name) |
| ua-plugin | `tools/ua-code-map.ts` + `knowledge/aidlc-shared/external-code-map.md` installed · `stage-graph.json` **unchanged** | no `adds`, so the graph does not move |
| graphify-plugin | `tools/graphify-map.ts` + `knowledge/aidlc-shared/external-code-map.md` installed · `stage-graph.json` **unchanged** | same shape as the row above |
| prerequisites | the `INSTALL.md` report | every line accounted for; MCP file parses, no other key changed. The added `figma` entry has no `disabled` key; the stock Kiro CLI entries keep their `"disabled": true` |
| 0 regressions | `doctor` · `graph compile --check` | **same doctor count as before apply** · exit 0. 🔴Do not record absolute doctor numbers here |
| idempotent | `aidlc-plugin-test.ts` | `Idempotent second compose: true` |

Measured 2026-10-26 on AI-DLC v2.11.1 (claude and kiro-ide trees packaged from the tag):
`visual-mockups` 0.2.0 and `graphify-plugin` 0.2.0 validate `VALID` and test `CLEAN`, sync with the
`aidlc` 2.11.1 binary into the same tree side by side, and both `INSTALL.md` procedures run through.

## Known · deliberately untouched

- **Overlay-only plugins are selectable once composed.** Since `v2.10.1-preview.20261004.1`
  (upstream #1675, so every 2.11 release) the known-plugin list also reads compose's records under `tools/data/` (`plugin-contrib-`, `plugin-owned-`,
  `plugin-compose-<p>.json`), not only stage and scope owners. Measured 2026-11-06 on a
  kiro-ide 2.11.3 project with visual-mockups composed: `aidlc engine plugin select`
  prints `Known plugins: aidlc, visual-mockups`. Earlier engines listed only stage and scope
  owners, so an overlay-only plugin did not appear there.
- **`visual-mockups` deliberately reverses two earlier positions** — it puts the
  plugin back in, and it does touch the MCP file. The patch layer itself still
  does not: the `figma` key is added only when a person asks for the Figma path.
- **The code-map plugins do not restate the rules in the stage.** How to treat a map
  belongs to `knowledge/aidlc-shared/external-code-map.md`, which each ships and
  compose installs into `<harness>/knowledge/aidlc-shared/`; the delegated
  personas' **MANDATORY** "Delegated knowledge preflight" reads that directory, so
  the rules reach reverse-engineering. The fragments carry only WHERE/WHEN (the
  conductor procedure).
