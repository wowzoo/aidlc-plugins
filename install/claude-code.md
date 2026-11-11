# Install {{PLUGIN}} {{VERSION}} into an AI-DLC project — Claude Code

This folder came out of `{{ZIP}}`, unzipped at the project root, so
it sits at `.claude/aidlc-plugins/{{PLUGIN}}/`. Tell the AI:

```
Read .claude/aidlc-plugins/{{PLUGIN}}/INSTALL.md to the end and follow it.
```

---

## For the AI: follow this procedure

Claude Code installs the plugin from its own plugin store, which keeps the plugin's files outside
the project. The steps below register this folder as a local marketplace, install the plugin for
this project only, compose it into AI-DLC, and then install what the plugin cannot carry.

Rules for every step:

- **Never overwrite, never delete.** When something with the same name exists and differs, show
  the difference and ask the person.
- **Outside this folder, change only what the steps name.**
- **Install no tool the steps do not name.** No step needs Python or Node; read files with `cat`
  or your own file reader. AI-DLC's native install brings neither, and on a new Mac `python3`
  opens an install dialog.
- `<project>` is the absolute project root; `<CFG>` is `${CLAUDE_CONFIG_DIR:-$HOME/.claude}`. Run
  every command from `<project>`.
- Report in the Step 7 format at the end.

### Step 1 — check the project

```bash
cat .claude/tools/data/harness.json    # read it: "name" must be "claude"
aidlc --version
claude --version
aidlc doctor 2>&1 | tail -1        # note the problem count
```

- Not `claude`: this zip is for Claude Code. Stop and tell the person which zip matches their tool.
- `aidlc` or `claude` not found: stop and say so.
- `aidlc` older than 2.11.2: this procedure was measured on 2.11.2 and 2.11.3. Tell the person and ask whether
  to continue.
- Ask whether an intent is in progress. Installing changes the stages; between intents is safest.

**Alternatives:** `ua-plugin` and `graphify-plugin` are two tools for the same step. If you are
installing one of them and the other is present, stop and ask which one stays:

```bash
grep -o 'plugin:\(ua\|graphify\)-plugin:' .claude/aidlc-common/stages/inception/reverse-engineering.md | sort -u
```

### Step 2 — copy this folder to the user's plugin sources

Claude Code remembers one source folder per marketplace name for the whole user, not per project.
Keep that source where it outlives this project:

```bash
SRC="<CFG>/aidlc-plugins/{{PLUGIN}}"
ls "$SRC" 2>/dev/null && diff -rq .claude/aidlc-plugins/{{PLUGIN}} "$SRC"
```

- `$SRC` missing: `mkdir -p "<CFG>/aidlc-plugins" && cp -R .claude/aidlc-plugins/{{PLUGIN}} "$SRC"`
- `$SRC` present, no diff output: same version, move on.
- `$SRC` present and different: another version is installed for this user. Show the
  `"version"` in `$SRC/.claude-plugin/plugin.json` and in this folder's, and ask the person.
  Upgrading in place has not been measured.

### Step 3 — install the plugin for this project

```bash
claude plugin marketplace add "$SRC" --scope local
claude plugin install {{PLUGIN}}@{{PLUGIN}} --scope local
```

`--scope local` writes `.claude/settings.local.json`, which AI-DLC already lists in `.gitignore`.
Each person installs for themselves; nothing shared changes. A message that plugins installed from
this marketplace "now update from the new source" is expected when another project added it first.

### Step 4 — compose it into AI-DLC

```bash
AIDLC_HARNESS_DIR=.claude AIDLC_HARNESS_NAME=claude aidlc engine plugin sync
AIDLC_HARNESS_DIR=.claude aidlc engine plugin list
ls .claude/tools/data/plugin-compose-{{PLUGIN}}.json
find .claude -name '*.drops'
```

Expect `plugin sync complete`, the plugin listed as `current`, the compose record present, and no
`.drops` file. From now on the plugin's SessionStart hook runs the same sync at every session start.

If sync exits non-zero, show its last lines and stop. Sync is a transaction: one dropped
contribution rolls the whole sync back, so nothing half-applied is left behind.

### Step 5 — what the plugin cannot carry

If `prerequisites/INSTALL.md` exists in this folder, read it to the end and follow it now. It
installs skills into `.claude/skills/` and, where needed, MCP servers through `claude mcp add
--scope local`.

### Step 6 — verify

```bash
aidlc doctor 2>&1 | tail -1        # same problem count as Step 1
```

A plugin that adds stages or scopes rewrites `.claude/skills/aidlc/tables.md`, and doctor then warns
`AI-DLC files: 1 changed in this project, so aidlc config keeps it and stops`. That is expected and
the warning is wrong about the stop: measured on 2.11.2, `aidlc config` afterwards runs with
`conflict=0`, keeps the plugin, and the warning clears. Never suggest `aidlc config --force`.

### Step 7 — report

```
harness: Claude Code
plugin: {{PLUGIN}} <"version" in .claude/tools/data/plugin-compose-{{PLUGIN}}.json>
source: <CFG>/aidlc-plugins/{{PLUGIN}} — copied | already there
installed: local scope | already installed
compose: current, drops 0 | <the sync error>
prerequisites: <the report from prerequisites/INSTALL.md> | none
doctor: <before> → <after> problems
```

Then tell the person:

- Restart Claude Code in this project so it loads the plugin's hook and any new skills.
- `.claude/aidlc-plugins/{{PLUGIN}}/` is no longer needed; Claude Code reads its own copy. It is
  theirs to delete or keep. It is not project code: AI-DLC's reverse engineering skips `.claude/`.

---

## Where things end up

| What | Where | Seen by reverse engineering |
|---|---|---|
| plugin files Claude Code loads | `<CFG>/plugins/cache/{{PLUGIN}}/{{PLUGIN}}/<version>/` | no — outside the project |
| marketplace source | `<CFG>/aidlc-plugins/{{PLUGIN}}/` | no — outside the project |
| install record | `.claude/settings.local.json` (git-ignored) | no |
| composed stages, tools, knowledge | `.claude/` | no — harness directory |
| skills from `prerequisites/` | `.claude/skills/` | no — harness directory |
| MCP servers from `prerequisites/` | `<CFG>/.claude.json`, under this project | no — outside the project |

Measured on AI-DLC 2.11.2 with Claude Code 2.1.314: project type, the CodeKB source snapshot and
the source boundary are unchanged after install, and `aidlc config` afterwards reports no conflict.
A server added to the project's `.mcp.json` instead does enter the source boundary.
