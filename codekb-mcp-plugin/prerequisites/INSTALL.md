# Prerequisites for codekb-mcp-plugin — a procedure for the AI

An AI-DLC plugin cannot carry MCP servers. codekb-mcp-plugin's steps call the CodeKB service
through the MCP server `code-knowledge-base`, so the server entry is added here, **after** the
plugin is composed. AI-DLC's agents then pick the server up themselves (on Kiro CLI V2, after one
`aidlc config`).

| Needs | Why |
|---|---|
| a CodeKB service endpoint, and the repos indexed there as spaces | the plugin reads spaces; it never creates them |
| the server under the key **`code-knowledge-base`**, exactly | the plugin and AI-DLC's own composer agent look for that name |
| a login that reaches those spaces | the service follows the caller's Git access: public repos for any signed-in user, private repos only where the user's token reaches |
| AI-DLC 2.11.1 or later on Kiro | from 2.11.1 every AI-DLC agent on Kiro sees the servers the person adds; before it, only the conductor did |

Without any of them, every step of the plugin skips itself and the stages run as stock.

🔴 **The service holds the code it indexes.** Indexing a repo uploads it to the service and to the
model provider behind it. Use only an instance the code's owner allows. This procedure connects to
an instance; it does not decide that question. Ask the person if it has not been settled.

Tell the AI:

```
Read <path to this folder>/INSTALL.md to the end and follow it to install codekb-mcp-plugin's prerequisites into this project.
```

---

## For the AI: follow this procedure

Rules for every step:

- **Never overwrite.** If a `code-knowledge-base` entry already exists with the same URL, move on.
  If its URL differs, show both and ask the person.
- **Never delete.** Leftovers are reported, not removed.
- **Outside this folder, change only the files named below.**
- **Never edit `<H>/agents/aidlc*`**, and do not ask the person to (Step 5).
- Report in the Step 7 format at the end.

### Step 1 — find the project and the harness

The project root is where `aidlc/` sits next to a harness directory.

| Present | Harness | `<H>` | `code-knowledge-base` goes to |
|---|---|---|---|
| `.kiro/aidlc-common/` and `.kiro/agents/aidlc.json` | Kiro CLI | `.kiro` | `.kiro/settings/mcp.json` |
| `.kiro/aidlc-common/`, no `.kiro/agents/aidlc.json` | Kiro IDE (and Kiro CLI on its v3 engine) | `.kiro` | `.kiro/settings/mcp.json` |
| `.claude/aidlc-common/` | Claude Code | `.claude` | `claude mcp add --scope local` |
| `.codex/aidlc-common/` | Codex | `.codex` | `.codex/config.toml` |

If more than one harness directory or none is present, stop and ask the person.

Not the project's `.mcp.json`: a server there enters AI-DLC's source boundary (measured on 2.11.2).

### Step 2 — confirm the plugin is composed

```bash
grep -l "plugin:codekb-mcp-plugin:" \
  <H>/aidlc-common/stages/inception/reverse-engineering.md \
  <H>/aidlc-common/stages/inception/requirements-analysis.md \
  <H>/aidlc-common/stages/construction/functional-design.md
ls <H>/knowledge/aidlc-shared/codekb-mcp.md
```

All four files must be listed. If any is missing, the plugin is not composed yet. Stop and say so.
Compose the plugin first (`../INSTALL.md` in a packaged plugin, `../README.md` in the source repo).

### Step 3 — ask for the endpoint, then check it answers

Ask the person for the service's MCP URL. Do not guess one, and do not take one from anywhere but
the person or a configuration they point you to. Note that some deployments put `/mcp` twice in the
path (`https://<host>/mcp/mcp`).

Check that it is reachable and asks for a login. This does not sign in and sends no credentials:

```bash
curl -sS -o /dev/null -D - -X POST "<url>" -H 'Content-Type: application/json' -d '{}' | grep -iE '^(HTTP|www-authenticate)'
```

- `401` with a `WWW-Authenticate: Bearer` line: reachable, login required. Go on.
- `200`, `400` or `406`: reachable without a login. Go on, and say so in the report.
- No answer, `403` or `404`: stop. Show the person the output and ask them to check the URL and
  their network.

### Step 4 — register `code-knowledge-base`

**Kiro IDE, Kiro CLI**: `.kiro/settings/mcp.json`, the project's own file.

First look in both `.kiro/settings/mcp.json` and `~/.kiro/settings/mcp.json` (`cat` each; a missing
file is fine). A `code-knowledge-base` server in the person's `~/.kiro/settings/mcp.json` is
already available to this project. Tell the person and do not add a second one.

Then add it through Kiro's own command when `kiro-cli` is installed (`command -v kiro-cli`):

```bash
kiro-cli mcp add --name code-knowledge-base --url "<url>" --scope workspace
cat .kiro/settings/mcp.json
```

It writes `"code-knowledge-base": {"url": "<url>"}` under `mcpServers` and leaves other entries as they
are. Kiro CLI on its v3 engine refuses a direct file write to `.kiro/settings/mcp.json`
(`Blocked by a permission rule … Source: kiro-scope`, measured on Kiro CLI 3.2.0). That is
deliberate: do not try to get around it with another tool. The command above is Kiro's supported way.

Without `kiro-cli` (Kiro IDE only): read the file. If it does not exist, create it as
`{"mcpServers": {}}`. Add the one key above and change nothing else. If the write is refused, show
the person the key and ask them to add it through Kiro IDE's "Open workspace MCP config".

Either way, read the file back and check it is still valid JSON: one `mcpServers` object, commas
between entries, no trailing comma. Leave the other entries as they are, including any
`"disabled": true` on Kiro CLI's stock servers.

**On a remote host** (Kiro running over SSH, the browser on another machine): the login redirects
the browser to `http://localhost:<port>/oauth/callback` on the browser's machine, where nothing
listens. Three things made it work (measured on Kiro CLI 3.2.0, 2026-11-11):

- **Pin the port.** Kiro picks a new random port for each attempt, and its listener waits only a
  few minutes, so a tunnel opened after the link arrives is often too late. Show the person this
  key to add to the server's entry in `.kiro/settings/mcp.json` (Kiro refuses your write; `kiro-cli
  mcp add` has no option for it), next to `"url"`:
  `"oauth": {"redirectUri": "http://localhost:53682/oauth/callback"}`. Any free port works; the
  service accepts any localhost port.
- **Forward it before starting the login**, from the browser's machine:
  `ssh -N -L 127.0.0.1:53682:127.0.0.1:53682 <host>`.
- **Start the login and open the link at once.** In Kiro CLI: `/mcp`, then `^A` on
  `code-knowledge-base` (or `Ctrl+y` when Kiro offers it). Copy the link whole: a link broken at a
  line wrap fails. When the browser shows a connection reset, the listener had already closed:
  press `^A` again and open the new link.

The token is stored in the remote user's `~/.kiro`, so later sessions on that host, headless ones
included, use it without logging in again.

**Claude Code**: register it through Claude Code, for this project and this person only. Do not
edit `.mcp.json`.

```bash
claude mcp get code-knowledge-base          # already there with <url> → move on
claude mcp add --scope local --transport http code-knowledge-base "<url>"
```

A `code-knowledge-base` entry already in the project's `.mcp.json` counts as present. Leave it.

**Codex**: `.codex/config.toml`. Look for `[mcp_servers.code-knowledge-base]` there and in
`${CODEX_HOME:-$HOME/.codex}/config.toml`. If neither has it, append to `.codex/config.toml`:

```toml
[mcp_servers.code-knowledge-base]
url = "<url>"
```

Read the file back (`cat .codex/config.toml`) and check the new table is whole and appears once.

### Step 5 — Kiro only: let AI-DLC's agents see the server

Do **not** edit `.kiro/agents/aidlc*`. Since AI-DLC 2.11.1 the agents pick up the servers you add
on their own. A hand edit is not needed, and it makes the next `aidlc config` stop on the edited
files.

| Harness | What makes the agents see `code-knowledge-base` | What you do |
|---|---|---|
| Kiro IDE, and Kiro CLI on its v3 engine (no `.kiro/agents/aidlc.json`) | every AI-DLC agent file sets `includeMcpJson: true`, Kiro's switch for every server in `.kiro/settings/mcp.json` and `~/.kiro/settings/mcp.json` | nothing |
| Kiro CLI on its V2 engine (`.kiro/agents/aidlc.json` present) | `aidlc config` writes `"@<server>"` into all 15 agent JSONs for every server in those two files | run `aidlc config --project-dir "<project>"` once, after Step 4 |

Check it:

```bash
grep -c '^includeMcpJson: true' .kiro/agents/aidlc*.md       # Kiro IDE / v3: one per file
grep -l '"@code-knowledge-base"' .kiro/agents/*.json         # Kiro CLI V2, after aidlc config: every agent JSON
```

On Kiro CLI V2, if `aidlc config` reports conflicts, show them and stop. Do not pass `--force`.

Every call to the server still asks the person first. AI-DLC leaves `allowedTools` and permissions
as they are. Say this in the report: the person approves each CodeKB call, or trusts the server's
tools for the session when Kiro offers it.

The agents that call the service, and what happens when one cannot:

| Agent | Calls it at | When it cannot |
|---|---|---|
| the conductor | reverse-engineering Step 1c, requirements-analysis, functional-design (all inline) | the plugin does nothing |
| `aidlc-developer-agent` | the reverse-engineering code scan, querying the service itself | the developer works from the orientation file only |
| `aidlc-composer-agent` | AI-DLC's own workflow composition (stock behaviour, not this plugin) | the composer scores from a workspace scan |

Claude Code needs nothing either: its subagents use the session's MCP servers. Codex's agent files
(`.codex/agents/*.toml`) name no MCP servers. Whether Codex's subagents reach the server has not
been measured, so the plugin treats them as not reaching it.

### Step 6 — look for an earlier space choice (report only)

```bash
ls aidlc/spaces/*/knowledge/aidlc-shared/codekb-mcp-spaces.md 2>/dev/null
```

Report each file and its rows. reverse-engineering reads it before matching spaces by git URL. A
person may also write it in advance, in the format shown in reverse-engineering Step 1c. Do not
change it here.

### Step 7 — verify and report

```bash
cat .kiro/settings/mcp.json                 # Kiro: the entry is there
claude mcp get code-knowledge-base          # Claude Code
grep -n -A1 'mcp_servers.code-knowledge-base' .codex/config.toml   # Codex
aidlc doctor        # the problem count should be the same as before
```

Report:

```
harness: <Kiro IDE | Kiro CLI | Claude Code | Codex>
plugin: codekb-mcp-plugin <"version" in <H>/tools/data/plugin-compose-codekb-mcp-plugin.json, or "composed">
endpoint: <url> — <401 login required | reachable without login>
code-knowledge-base: added (<.kiro/settings/mcp.json | claude mcp, local scope | .codex/config.toml>) | already present (<where>)
agents (Kiro): includeMcpJson on every agent file | aidlc config wrote @code-knowledge-base into <n> agent JSONs | not Kiro
per-call approval: said to the person (Kiro)
space choices: none | <each codekb-mcp-spaces.md and its rows>
```

Then tell the person what is left for them, and how to check the login:

- **Claude Code:** restart it, then open `/mcp`, choose `code-knowledge-base` and finish the login in
  the browser.
- **Codex:** restart it, then run `codex mcp login code-knowledge-base`.
- **Kiro IDE:** run `Developer: Reload Window`, and finish the login when the MCP panel asks for it.
- **Kiro CLI:** restart `kiro-cli`. Finish the login when it asks.
- **Kiro, both:** each CodeKB call asks for approval first. That is AI-DLC's default, not a fault.

**The login check**, in a new session after the restart: ask the AI (in Kiro, with the aidlc agent)
to "call `list_spaces` on the code-knowledge-base server and list the space ids". A list means the
plugin can work. A login or credential message means the login is not finished. An empty list
means the login reaches no space: check the account's Git access on the service's web page.

**After a later `aidlc config`** the server entry and the agents' access stay: config keeps an added
`mcp.json` key, and on Kiro CLI V2 it writes the grants again from that file (measured on Kiro CLI V2, 2.11.4; for Kiro IDE an added key was kept on 2.11.1, measured for visual-mockups' `figma`).

---

## What this folder holds

Only this file. The plugin ships no skill, and the server entry is written by the steps above.
