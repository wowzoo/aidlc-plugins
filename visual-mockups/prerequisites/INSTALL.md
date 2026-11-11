# Prerequisites for visual-mockups — a procedure for the AI

An AI-DLC plugin cannot carry skills or MCP servers. visual-mockups' stage steps load skills by name
and, for Figma, call the `figma` MCP server, so those are installed here, **after** the plugin is
composed:

| Path | Needs |
|---|---|
| HTML preview | the `frontend-design` skill (in this folder). No account, no MCP server |
| Figma file | the `figma` MCP server, Figma's skills `figma-use`, `figma-generate-design`, `figma-create-new-file` (fetched from Figma's repository, not bundled), a Dev or Full seat on a paid Figma plan |

Without either, the stages still offer "neither" and the markdown mockup still reaches code.

Tell the AI:

```
Read <path to this folder>/INSTALL.md to the end and follow it to install visual-mockups' prerequisites into this project.
```

---

## For the AI: follow this procedure

Rules for every step:

- **Never overwrite.** If a skill directory with the same name exists and its content is the same,
  move on. If it differs, show the difference and ask the person. The same goes for an MCP server
  entry with the same key.
- **Never delete.** Leftovers from an older install are reported, not removed.
- **Outside this folder, change only the files named below.** Put anything you download in a new,
  empty temporary directory.
- **Never edit `<H>/agents/aidlc*`**, and do not ask the person to (Step 6).
- Report in the Step 8 format at the end.

### Step 1 — find the project and the harness

The project root is where `aidlc/` sits next to a harness directory.

| Present | Harness | `<H>` | Skills directory `<S>` | `figma` server goes to |
|---|---|---|---|---|
| `.kiro/aidlc-common/` and `.kiro/agents/aidlc.json` | Kiro CLI | `.kiro` | `<project>/.kiro/skills` | `.kiro/settings/mcp.json` |
| `.kiro/aidlc-common/`, no `.kiro/agents/aidlc.json` | Kiro IDE | `.kiro` | `<project>/.kiro/skills` | `.kiro/settings/mcp.json` |
| `.claude/aidlc-common/` | Claude Code | `.claude` | `<project>/.claude/skills` | `claude mcp add --scope local` |
| `.codex/aidlc-common/` | Codex | `.codex` | `${CODEX_HOME:-$HOME/.codex}/skills` | `.codex/config.toml` |

If more than one harness directory or none is present, stop and ask the person.

Two places outside the project on purpose (measured on 2.11.2): a server added to the project's
`.mcp.json`, and a skill copied into the project's `.agents/skills/`, both enter AI-DLC's source
boundary, the snapshot code generation is checked against. A `.agents/skills/` skill whose name
does not start with `aidlc` also enters the reverse-engineering source snapshot.

### Step 2 — confirm the plugin is composed

```bash
grep -l "plugin:visual-mockups:" \
  <H>/aidlc-common/stages/ideation/rough-mockups.md \
  <H>/aidlc-common/stages/inception/refined-mockups.md \
  <H>/aidlc-common/stages/construction/code-generation.md
```

All three files must be listed. If any is missing, the plugin is not composed yet. Stop and say so —
compose the plugin first (`../INSTALL.md` in a packaged plugin, `../README.md` in the source repo).

### Step 3 — ask which paths to prepare

Ask the person:

- **HTML only** — installs `frontend-design`. Nothing else is needed.
- **HTML and Figma** — also installs the Figma skills and the `figma` server. Say up front that the
  Figma path needs a Dev or Full seat on a paid Figma plan, and that by using the Figma MCP server and Figma's skills they
  agree to the Figma Developer Terms (https://www.figma.com/legal/developer-terms/).
- **Neither** — stop here and report.

### Step 4 — copy `frontend-design`

Copy `skills/frontend-design/` to `<S>/frontend-design/` as a whole directory, `LICENSE.txt`
included. If it is already there:

```bash
# run from this folder; <S> is the skills directory from Step 1, as an absolute path
diff -rq "skills/frontend-design" "<S>/frontend-design"   # no output = same → move on
```

### Step 5 — Figma only: the skills and the server

**Already provided?** On Claude Code, Figma's own plugin brings both the skills and the server:

```bash
grep -o '"figma@[^"]*"' "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/plugins/installed_plugins.json" 2>/dev/null
```

If that prints a name, skip 5a and 5b and say so in the report. An installed plugin can still be
disabled: tell the person to check it is enabled in `/plugin`.

**5a — fetch Figma's skills** from its repository into a new, empty temporary directory:

```bash
SRC="$(mktemp -d)"
git clone --depth 1 --filter=blob:none --sparse https://github.com/figma/mcp-server-guide "$SRC/repo"
git -C "$SRC/repo" sparse-checkout set skills/figma-use skills/figma-generate-design skills/figma-create-new-file
git -C "$SRC/repo" rev-parse HEAD        # put this commit in the report
ls "$SRC/repo/skills"
```

If `git` is missing or the clone fails, stop the Figma path, say why, and continue with Step 7.

Copy each of the three directories to `<S>/<name>/` as a whole. For one that already exists,
compare with `diff -rq` as in Step 4; when it differs, show the difference and ask before replacing
it (an older copy is common: Figma updates these skills along with its server).

**5b — register the `figma` server** where Step 1 says. A `figma` server that already exists with
the same URL is fine — move on. A different one: show it and ask.

**Kiro IDE, Kiro CLI** — `.kiro/settings/mcp.json`, the project's own file.

First look in both `.kiro/settings/mcp.json` and `~/.kiro/settings/mcp.json` (`cat` each; a missing
file is fine). A `figma` server in the person's `~/.kiro/settings/mcp.json` is already available to
this project: tell the person and do not add a second one.

Then add it through Kiro's own command when `kiro-cli` is installed (`command -v kiro-cli`):

```bash
kiro-cli mcp add --name figma --url https://mcp.figma.com/mcp --scope workspace
cat .kiro/settings/mcp.json
```

It writes `"figma": {"url": "https://mcp.figma.com/mcp"}` under `mcpServers` and leaves other entries
as they are. Kiro CLI on its v3 engine refuses a direct file write to `.kiro/settings/mcp.json`
(`Blocked by a permission rule … Source: kiro-scope`, measured on Kiro CLI 3.2.0). That is
deliberate: do not try to get around it with another tool. The command above is Kiro's supported way.

Without `kiro-cli` (Kiro IDE only): read the file. If it does not exist (Kiro IDE ships none),
create it as `{"mcpServers": {}}`. Add the one key above and change nothing else. If the write is
refused, show the person the key and ask them to add it through Kiro IDE's "Open workspace MCP
config".

Either way, read the file back and check it is still valid JSON: one `mcpServers` object, commas
between entries, no trailing comma. Leave the other entries as they are, including any
`"disabled": true` on Kiro CLI's stock servers.

**Claude Code** — through Claude Code, for this project and this person only. Do not edit `.mcp.json`.

```bash
claude mcp get figma          # already there with https://mcp.figma.com/mcp → move on
claude mcp add --scope local --transport http figma https://mcp.figma.com/mcp
```

A `figma` entry already in the project's `.mcp.json` counts as present: leave it.

**Codex** — `.codex/config.toml`. Look for `[mcp_servers.figma]` there and in
`${CODEX_HOME:-$HOME/.codex}/config.toml`; if neither has it, append to `.codex/config.toml`:

```toml
[mcp_servers.figma]
url = "https://mcp.figma.com/mcp"
```

Read the file back (`cat .codex/config.toml`) and check the new table is whole and appears once.

`aidlc config` keeps the added server and the added skills when it later refreshes the project
(measured on 2.11.1 for Kiro, on 2.11.2 for Codex's `.codex/config.toml`: `conflict=0`, `figma`
still there). The Claude Code server lives outside the project, where `aidlc config` does not go.
That Codex reaches Figma through this entry has not been measured.

### Step 6 — Kiro and Figma only: let AI-DLC's agents see the server

Do **not** edit `.kiro/agents/aidlc*`. Since AI-DLC 2.11.1 the agents pick up the servers you add
on their own (upstream #2535). A hand edit is not needed, and it makes the next `aidlc config` stop
on the edited files.

| Harness | What makes the agents see `figma` | What you do |
|---|---|---|
| Kiro IDE, and Kiro CLI on its v3 engine (no `.kiro/agents/aidlc.json`) | every AI-DLC agent file sets `includeMcpJson: true`, Kiro's switch for every server in `.kiro/settings/mcp.json` and `~/.kiro/settings/mcp.json` | nothing |
| Kiro CLI on its V2 engine (`.kiro/agents/aidlc.json` present) | `aidlc config` writes `"@<server>"` into all 15 agent JSONs for every server in those two files | run `aidlc config --project-dir "<project>"` once, after Step 5b |

Check it:

```bash
grep -c '^includeMcpJson: true' .kiro/agents/aidlc*.md       # Kiro IDE / v3: one per file
grep -l '"@figma"' .kiro/agents/*.json                         # Kiro CLI V2, after aidlc config: every agent JSON
```

On Kiro CLI V2, if `aidlc config` reports conflicts, show them and stop. Do not pass `--force`.

The conductor calls Figma at rough-mockups and refined-mockups (they run inline), and
`aidlc-developer-agent` at code-generation, where it reads the design for a UI unit. Each call asks
the person first: AI-DLC leaves `allowedTools` and permissions as they are. Claude Code needs
nothing either: its agents use the project's MCP servers. Codex's agent files name no MCP servers;
that Codex's subagents reach Figma has not been measured.

### Step 7 — look for records named by the older version (report only)

visual-mockups 0.1.0 wrote its pointer as `mockup-visual-ref.md` and `mockup-visual-ref-refined.md`.
0.2.0 writes and reads `visual-mockups-ref.md` and `visual-mockups-ref-refined.md`.

```bash
find aidlc/spaces -name 'mockup-visual-ref*.md' 2>/dev/null
grep -l "mockup-visual-ref" <H>/aidlc-common/stages/*/*.md 2>/dev/null
```

Report each one.

- **A record file:** an intent still in progress will not find its old pointer at code-generation.
  Renaming the file to the new name is the person's decision.
- **A stage file:** 0.1.0 was composed into this tree and its `produces`/`consumes` are still in
  that stage's frontmatter, so the graph carries both names. The fix is in `../README.md`
  ("Upgrading from 0.1.0"); tell the person, do not edit the stage file yourself.

### Step 8 — verify and report

```bash
ls <S>/frontend-design/SKILL.md
ls <S>/figma-use/SKILL.md <S>/figma-generate-design/SKILL.md <S>/figma-create-new-file/SKILL.md   # Figma only
aidlc doctor        # the problem count should be the same as before
```

Report:

```
harness: <Kiro IDE | Kiro CLI | Claude Code | Codex>
plugin: visual-mockups <"version" in <H>/tools/data/plugin-compose-visual-mockups.json, or "composed">
paths: HTML only | HTML and Figma | neither
frontend-design: installed | already present | skipped (<reason>)
figma skills: installed from figma/mcp-server-guide@<commit> | already present | provided by Figma's Claude Code plugin | skipped (<reason>)
figma server: added (<.kiro/settings/mcp.json | claude mcp, local scope | .codex/config.toml>) | already present (<where>) | skipped (<reason>)
agents (Kiro): includeMcpJson on every agent file | aidlc config wrote @figma into <n> agent JSONs | not Kiro or no Figma
old pointer records: none | <each path from Step 7>
```

Then tell the person what is left for them:

- **Figma account:** the first Figma call asks them to authorize; a Dev or Full seat on a paid plan
  is required.
- **Claude Code:** restart it, then finish Figma's authorization in `/mcp`.
- **Codex:** restart it, then run `codex mcp login figma` to authorize.
- **Kiro IDE:** run `Developer: Reload Window`, and check in the MCP panel that `figma` is connected
  and authorized.
- **Kiro CLI:** restart `kiro-cli`, then authorize `figma` when it asks (`/mcp`).
- **Kiro, both:** each Figma call asks for approval first. That is AI-DLC's default, not a fault.

**If an older version of this procedure had you edit `.kiro/agents/aidlc*`** (adding `"@figma"` by hand),
the next `aidlc config` stops with `locally modified or unowned` on those files. Run
`aidlc config --project-dir "<project>" --dry-run` and read the conflict list; when it names only
those agent files, the person moves them out of the project (the hook blocks you from moving them)
and `aidlc config` runs again without `--force`. No edit is needed on the fresh files.

---

## What this folder holds

| Path | What |
|---|---|
| `skills/frontend-design/` | Anthropic's `frontend-design` skill (Apache-2.0, `LICENSE.txt`), from `anthropics/skills` at `41bbe19d1a` |

Figma's skills are not in this folder. Figma publishes them in `figma/mcp-server-guide` without a
licence file, so Step 5 fetches them from there instead of shipping a copy.
