# Install {{PLUGIN}} {{VERSION}} into an AI-DLC project — {{PRODUCT}}

This folder came out of `{{ZIP}}`, unzipped at the project root,
so it sits at `.kiro/aidlc-plugins/{{PLUGIN}}/`. Tell the AI:

```
Read .kiro/aidlc-plugins/{{PLUGIN}}/INSTALL.md to the end and follow it.
```

---

## For the AI: follow this procedure

Kiro has no plugin store. The plugin lives in this folder, inside the project, and AI-DLC composes
it from here. The steps below compose it and then install what the plugin cannot carry.

Rules for every step:

- **Never overwrite, never delete.** When something with the same name exists and differs, show
  the difference and ask the person.
- **Outside this folder, change only what the steps name.**
- **Install no tool the steps do not name.** No step needs Python or Node; read files with `cat`
  or your own file reader. AI-DLC's native install brings neither, and on a new Mac `python3`
  opens an install dialog.
- **Never edit `.kiro/agents/aidlc*` yourself.** AI-DLC's hook refuses it; when a step needs it,
  the person makes the edit.
- `<project>` is the absolute project root. Run every command from `<project>`.
- Report in the Step 6 format at the end.

### Step 1 — check the project

```bash
cat .kiro/tools/data/harness.json      # read it: "name" must be "{{HARNESS}}"
aidlc --version
aidlc doctor 2>&1 | tail -1        # note the problem count
```

- Not `{{HARNESS}}`: this zip is for the `{{HARNESS}}` harness ({{PRODUCT}}). AI-DLC has two Kiro
  harnesses and they need different builds: `kiro-ide` for Kiro IDE and for Kiro CLI on its v3
  engine, `kiro` for Kiro CLI on its V2 engine. Stop and tell the person which build matches the
  harness `aidlc config` set up for this project.
- `aidlc` not found: stop and say so.
- `aidlc` older than 2.11.2: this procedure was measured on 2.11.2 and 2.11.3. Tell the person and ask whether
  to continue.
- Ask whether an intent is in progress. Installing changes the stages; between intents is safest.

**Alternatives:** `ua-plugin` and `graphify-plugin` are two tools for the same step. If you are
installing one of them and the other is present, stop and ask which one stays:

```bash
grep -o 'plugin:\(ua\|graphify\)-plugin:' .kiro/aidlc-common/stages/inception/reverse-engineering.md | sort -u
ls -d .kiro/aidlc-plugins/*/ 2>/dev/null
```

### Step 2 — compose it into AI-DLC

```bash
AIDLC_PLUGIN_ROOT="<project>/.kiro/aidlc-plugins/{{PLUGIN}}" AIDLC_PROJECT_DIR="<project>" \
  AIDLC_HARNESS_DIR=.kiro aidlc engine plugin sync
AIDLC_HARNESS_DIR=.kiro aidlc engine plugin list
ls .kiro/tools/data/plugin-compose-{{PLUGIN}}.json
find .kiro -name '*.drops'
```

Expect `plugin sync complete: 1 plugin(s)`, the plugin listed with its version under `COMPOSED`
(`not compared: no host plugin list` is normal on Kiro), the compose record present, and no
`.drops` file.

If sync exits non-zero, show its last lines and stop. Sync is a transaction: one dropped
contribution rolls the whole sync back, so nothing half-applied is left behind.

### Step 3 — what the plugin cannot carry

If `prerequisites/INSTALL.md` exists in this folder, read it to the end and follow it now. On Kiro it
installs skills into `.kiro/skills/` and, where needed, MCP servers into `.kiro/settings/mcp.json`.

### Step 4 — verify

```bash
aidlc doctor 2>&1 | tail -1        # same problem count as Step 1
```

A plugin that adds stages or scopes rewrites `.kiro/skills/aidlc/tables.md`, and doctor then warns
`AI-DLC files: 1 changed in this project, so aidlc config keeps it and stops`. That is expected and
the warning is wrong about the stop: measured on 2.11.2, `aidlc config` afterwards runs with
`conflict=0`, keeps the plugin, and the warning clears. Never suggest `aidlc config --force`.

### Step 5 — keep this folder

AI-DLC composes the plugin from `.kiro/aidlc-plugins/{{PLUGIN}}/`. Do not delete or move it, and tell
the person the same. It is not project code: AI-DLC's reverse engineering skips `.kiro/`. If the
project is shared through git, committing this folder gives everyone the plugin.

### Step 6 — report

```
harness: {{PRODUCT}}
plugin: {{PLUGIN}} <"version" in .kiro/tools/data/plugin-compose-{{PLUGIN}}.json>
compose: composed, drops 0 | <the sync error>
prerequisites: <the report from prerequisites/INSTALL.md> | none
doctor: <before> → <after> problems
```

Then tell the person what happens next on their tool:

- **`kiro-ide` harness (Kiro IDE, and Kiro CLI on its v3 engine):** the zip also placed
  `.kiro/hooks/aidlc-{{PLUGIN}}-compose.json`. That hook runs the same sync when a session starts, on
  its first prompt, so a newer zip unzipped over this one is picked up by itself. In Kiro IDE, reload
  the window (`Developer: Reload Window`) so Kiro sees any new skills; in Kiro CLI, start `kiro-cli`
  again.
- **`kiro` harness (Kiro CLI on its V2 engine):** there is no hook. After unzipping a newer version,
  run Step 2 again, then start `kiro-cli` again so it sees any new skills.

---

## Where things end up

| What | Where | Seen by reverse engineering |
|---|---|---|
| the plugin | `.kiro/aidlc-plugins/{{PLUGIN}}/` | no — harness directory |
| compose hook (`kiro-ide` harness only) | `.kiro/hooks/aidlc-{{PLUGIN}}-compose.json` | no — harness directory |
| composed stages, tools, knowledge | `.kiro/` | no — harness directory |
| skills from `prerequisites/` | `.kiro/skills/` | no — harness directory |
| MCP servers from `prerequisites/` | `.kiro/settings/mcp.json` | no — harness directory |

Measured on AI-DLC 2.11.2 (`kiro-ide` and `kiro` harnesses): project type, the CodeKB source
snapshot and the source boundary are unchanged after install, and `aidlc config` afterwards reports
no conflict and keeps the plugin composed. In Kiro IDE the compose hooks ran on the first prompt of
a new session; on Kiro CLI v3 with the `kiro-ide` harness the same hook was reported to run on the
first input.
