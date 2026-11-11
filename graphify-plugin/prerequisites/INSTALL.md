# Prerequisites for graphify-plugin — a procedure for the AI

An AI-DLC plugin cannot carry skills. graphify-plugin works without any (its stage step, converter
and rules file are complete), but people starting from scratch need help running Graphify and the
converter. That help is the `aidlc-graphify-code-map` skill in this folder, installed **after** the
plugin is composed.

Tell the AI:

```
Read <path to this folder>/INSTALL.md to the end and follow it to install graphify-plugin's prerequisites into this project.
```

---

## For the AI: follow this procedure

Rules for every step:

- **Never overwrite.** If a skill directory with the same name exists and its content is the same,
  move on. If it differs, show the difference and ask the person.
- **Never delete.** Leftovers from an older install are reported, not removed.
- **Outside this folder, change only the files named below.**
- Report in the Step 6 format at the end.

### Step 1 — find the project and the harness

The project root is where `aidlc/` sits next to a harness directory.

| Present | Harness | `<H>` | Skills directory `<S>` |
|---|---|---|---|
| `.kiro/aidlc-common/` | Kiro IDE or Kiro CLI | `.kiro` | `<project>/.kiro/skills` |
| `.claude/aidlc-common/` | Claude Code | `.claude` | `<project>/.claude/skills` |
| `.codex/aidlc-common/` | Codex | `.codex` | `${CODEX_HOME:-$HOME/.codex}/skills` |

If more than one or none are present, stop and ask the person.

On Codex the skill goes to the user's skills directory, not the project's `.agents/skills/`: a
skill there enters AI-DLC's source boundary, the snapshot code generation is checked against
(measured on 2.11.2). Codex reads both.

### Step 2 — confirm the plugin is composed

```bash
grep -l "plugin:graphify-plugin:" <H>/aidlc-common/stages/inception/reverse-engineering.md
ls <H>/tools/graphify-map.ts <H>/knowledge/aidlc-shared/external-code-map.md
bun --version
```

- **`bun --version` fails:** the converter cannot run. Tell the person to install Bun
  (https://bun.sh) — a native AI-DLC install does not include it. Continue with the other steps.
- **No marker or a missing file:** the plugin is not composed yet. Stop and say so — compose the
  plugin first (`../INSTALL.md` in a packaged plugin, `../README.md` in the source repo).
- **`plugin:ua-plugin:` is also present** in that stage file: the two plugins are alternatives.
  Stop and ask which one stays.

### Step 3 — ask, then copy the skill

The skill is optional. Ask the person whether to install it. If yes, copy
`skills/aidlc-graphify-code-map/` to `<S>/aidlc-graphify-code-map/` as a whole directory. If
it is already there:

```bash
# run from this folder; <project> is the absolute project root from Step 1
diff -rq "skills/aidlc-graphify-code-map" "<S>/aidlc-graphify-code-map"   # no output = same → move on
```

A copy that differs and carries `scripts/graphify-map.ts` is the version an older installer landed,
with its own copy of the converter. Show the difference and ask before replacing it. This version
has no script of its own: it runs the converter the plugin installed in `<H>/tools/`.

### Step 4 — look for leftovers of the older install (report only)

Before graphify-plugin 0.2.0, a separate installer landed the rules and a guide outside the plugin.
Look for them:

```bash
ls GRAPHIFY_GUIDE.md 2>/dev/null
grep -l "^## External Code Map" aidlc/spaces/*/memory/project.md 2>/dev/null
ls aidlc/spaces/*/knowledge/aidlc-shared/external-code-map.md 2>/dev/null
```

Report each one that exists. The plugin now ships the rules file in `<H>/knowledge/aidlc-shared/`,
so a second copy under `aidlc/spaces/` reaches every agent twice and can drift from the plugin's.
Removing them is the person's decision; do not do it yourself.

### Step 5 — check the analysed repos (report only)

For each sibling repo that has a `graphify-out/` directory:

```bash
grep -qxE '/?graphify-out/?' <repo>/.gitignore && echo "listed" || echo "missing"
```

Do **not** edit the repo's `.gitignore` yourself — it is the person's repo. Report what is missing:
`graphify-out/` must be listed before the workflow starts, or under a strict policy CodeKB
publishing fails with `CODEKB_SOURCE_CHANGED`.

### Step 6 — verify and report

```bash
ls "<S>/aidlc-graphify-code-map/SKILL.md"
aidlc doctor        # the problem count should be the same as before
```

Report:

```
harness: <Kiro | Claude Code | Codex>
plugin: graphify-plugin <"version" in <H>/tools/data/plugin-compose-graphify-plugin.json, or "composed">
skill: installed | already present | skipped (<reason>)
leftovers: none | <each path from Step 4>
graphify-out/ in .gitignore: <repo>: listed | missing — one line per repo
for the person: <restart the harness so it sees the new skill; install Graphify if it is not installed>
```

---

## What this folder holds

| Path | What |
|---|---|
| `skills/aidlc-graphify-code-map/` | How to run Graphify on a repo and convert the result (optional) |
