# aidlc-plugins — authoring form and apply procedure

The authoring form of two AI-DLC plugins, plus the drivers that put them on a
tree or shell and judge the result.

```
visual-mockups/     gives the mockup stages a visual surface and carries the mockup into code
code-map/           lets reverse-engineering (2.1) use an external structural map as an index
scripts/            apply and judgement drivers
```

| Driver | What it does |
|---|---|
| `scripts/check-plugin-anchors.py` | `--pre` every declared anchor resolves in the compose base · `--post` every fragment actually landed |
| `scripts/merge-mcp-registry-kiro.py` | union-merges MCP entries into `.kiro/settings/mcp.json`, never overriding a stock key |
| `scripts/merge-mcp-registry-claude.py` | the same for a claude tree's root `.mcp.json`, writing no `disabled` key |
| `scripts/apply-mcp-registry-policy.py` | narrows the merged registry to a chosen server set and adds the `context7` header |

A plugin here is **not** a layer of the distributed tree — it is applied on
demand, so a committed tree does not carry one. The tradeoff is explicit: when a
plugin was a layer, that layer's `spec/manifest.json` pinned the apply result as
a sha map, so "spec output == compose output" was proved mechanically. That proof
is gone; apply is now judged by running the table below. What is gained is that
the plugin is a choice rather than a property of the tree.

---

## Apply — once per plugin

Run `compose` once per plugin. Order does not matter: compose keys drops
**per plugin** (`plugin-compose-<PLUGIN_KEY>.drops`) and each run touches only its
own sentinels, so two plugins on the same tree leave each other's sentinels
intact.

> 🔴 That per-plugin guarantee depends on `PLUGIN_KEY` resolving from the
> manifest. `PLUGIN_KEY` derivation looks for the manifest under
> `.aidlc-plugin` · `.claude-plugin` · `.codex-plugin` · `.kiro-plugin`; **ours is
> `.aidlc-plugin/plugin.json`**. If that name is missing from the list, derivation
> falls back to the parent directory segment — which, for the `/tmp` copies used in
> step 2, is `tmp` for *every* plugin. Both plugins would then share
> `plugin-compose-tmp.drops`, and a later clean compose would delete the earlier
> plugin's live degraded drop (drop files are removed on a no-drop run). Keep
> `.aidlc-plugin` first in that list.

> 🔴 **After editing the authoring form, delete the installed copy before
> composing.** `copyTreeNoClobber` does **not** overwrite — a dest whose content
> differs is recorded as a `[degraded]` drop and skipped (identical content is
> unrecorded and the re-run is harmlessly idempotent), and the installed copy stays
> stale. Editing a tool and re-running compose alone updates the driver-owned side
> while leaving the tool at its old sha.
> ```bash
> rm -f "$TARGET/$HD/tools/ua-code-map.ts"      # drop the installed copy of what you changed
> find "$TARGET" -name '*.drops' -delete         # and the previous run's drop records
> # then re-run step 2
> ```
> ⭐ The `drops 0` row of the judgement table catches this mistake.

```bash
TARGET=<root of the tree or shell>
HD=.kiro            # .claude for a claude tree/shell
ASSETS=<your asset tree>   # see "Prerequisites are supplied by the installer" below

# 1. 🔴 PRE-FLIGHT — measure that anchors resolve AND bind to the intended step
for P in visual-mockups code-map; do
  uv run python scripts/check-plugin-anchors.py --pre "$TARGET" --plugin-root "$P"
done
#    🔴🔴 "resolved" is not "bound correctly" — **read the titles.** A stage that drops
#    a step renumbers everything after it: one anchor then vanishes (and would be
#    dropped) while another survives and binds to the wrong step. The silent one is
#    worse. ⇒ **an anchor means a title, not a number.**
#    On exit 1 the fix belongs in the authoring form (`<plugin>/contributions/`),
#    not in the tree.

# 2. PLUGIN_ROOT is a /tmp copy (never hand the authoring form to compose directly)
for P in visual-mockups code-map; do
  R=/tmp/pr-$P; rm -rf $R; cp -R $P $R
  AIDLC_PLUGIN_ROOT=$R AIDLC_PROJECT_DIR="$TARGET" AIDLC_HARNESS_DIR=$HD bun $R/hooks/compose.ts
done
#    ⚠️ compose prints 0 lines even on success. Quiet is normal and is
#       indistinguishable from a quiet failure, so judge only by the table below.

# 3. 🔴 Install the prerequisites the seam cannot carry — **both plugins have them**
#    3a. visual-mockups: 4 skills + 2 MCP entries
for s in frontend-design figma-use figma-generate-design figma-create-new-file; do
  rm -rf "$TARGET/$HD/skills/$s"; cp -R "$ASSETS/custom-skills/$s" "$TARGET/$HD/skills/$s"
done
uv run python scripts/merge-mcp-registry-kiro.py   "$TARGET" --src "$ASSETS/custom-skills/mcp.json" --apply
uv run python scripts/merge-mcp-registry-claude.py "$TARGET" --src "$ASSETS/custom-skills/mcp.json" --apply

#    3b. code-map: 1 skill + UNDERSTANDING_GUIDE.md + shared knowledge + two prose pointers.
#        🔴 None of these four has a channel in `contributes` (no `skills` key · `memory` is
#        refused by the validator · a root file is not a content dir · `knowledge` is a valid
#        key but the pinned compose installs only stages, sensors and tools).
#        ⇒ the installer lands them from the owner originals. Assert with `--check`.
uv run python "$ASSETS/scripts/apply_external_code_map.py" "$TARGET"

# 4. 🔴 Judge by the artifact — exit code is not a judgement
for P in visual-mockups code-map; do
  uv run python scripts/check-plugin-anchors.py --post "$TARGET" --plugin-root "$P"
done
```

### Prerequisites are supplied by the installer

🔴 **The seam can ship neither skills nor MCP servers.** The valid
`aidlc.contributes` keys are `stages · overlays · agents · scopes · sensors ·
knowledge · tools`; `memory` is explicitly refused by the validator, and the
compose hook pinned here installs only **`stages`, `sensors` and `tools`**. So the
prerequisites — 4 skills and 2 MCP entries for `visual-mockups`, and the skill,
guide, knowledge file and prose pointers for `code-map` — are landed by whoever
applies the plugin, as in step 3.

Those prerequisite assets are **not part of this repository**: they are owned
elsewhere and referenced above as `$ASSETS`. Point `$ASSETS` at your own tree
containing `custom-skills/` (the four Figma-path skills, the
`aidlc-external-code-map` skill, and `mcp.json`), `custom-assets/`
(`UNDERSTANDING_GUIDE.md` and `knowledge/aidlc-shared/…`) and
`scripts/apply_external_code_map.py`. Skip step 3a if you only want the HTML
mockup path, which needs no MCP server — but it still needs the
`frontend-design` skill.

## 🔴 Judgement table — do not trust exit 0

| Item | How to measure | Expected |
|---|---|---|
| stage count unchanged | `stage-graph.json` array length · slug set | both unchanged (both plugins are overlay-only) |
| prose splice landed | `check-plugin-anchors.py --post` | per file, **sentinels = fragments×2** (open+close) · **`### Step Nb` headings owned by the plugin = fragment count**. 🔴**Never gate on the total heading count** — that is the host stage's own numbering and upstream moves it (a hardcoded value produces false FAILs) |
| drops | `find "$TARGET" -name '*.drops'` | **0**. Any file is a silent degrade |
| visual-mockups seam | `produces`/`consumes` delta | `rough` produces += `mockup-visual-ref` · `refined` produces += `mockup-visual-ref-refined`, consumes += `mockup-visual-ref` · `code-generation` consumes += all 4, optional. Exact-match counts: `mockup-visual-ref` **3** / `-refined` **2** |
| code-map | `tools/ua-code-map.ts` installed · `stage-graph.json` **unchanged** | no `adds`, so the graph does not move |
| prerequisite skills | `diff -rq` the 4 against their owner originals | **4/4 identical** (26 files) |
| MCP merge | server count · no stock key lost | **5 → 7** · keys overwritten **0** · 🔴**kiro marks every entry `disabled`; claude uses no `disabled` key at all** (the stock file has no such vocabulary) — the convention splits by harness, so the drivers are split |
| 0 regressions | `doctor` · `graph compile --check` · `loadAgents` | **same doctor count as before apply · 0 failed** · exit 0. 🔴Do not record absolute doctor numbers here |
| idempotent | stage files + graph sha after a 2nd compose | unchanged · a 2nd MCP run skips every key |
| byproducts | `scope-grid.json` · drop folders | no diff · drop folders in the tree: **0** |

## 🔴🔴 Do not regenerate compose.ts from the current upstream template

Both plugins' `hooks/compose.ts` is a **pinned older generation** of the template
plus the local `PLUGIN_KEY` delta noted above. The two copies are byte-identical
to each other — 673 lines, md5 `3dd2b7db0c44841efade53c4cbdefd8c` — and that is
the invariant to check after touching either one. Two reasons not to regenerate:

1. **The gap is large and widening** — the upstream template is ~1,866 lines
   against our 673.
2. **The current template has a stage-rejection path**
   (`rejectedStageFiles` / `recordDroppedStage`): if a plugin **adds** a stage and
   that stage references an agent that cannot be composed, the file is dropped.
   ⭐ Both plugins here are outside that path (neither adds a stage) — the risk
   appears **on replacement**.

⇒ `aidlc-plugin-validate.ts` reports exactly **one** error, `compose-hook-stale`,
for each plugin. It is expected. ⚠️ Contribution frontmatter carries **both**
`bundle:` and `plugin:` — the pinned compose reads `bundle:` while the current
validator's `stage-owner` rule requires `plugin:`. (`visual-mockups` still carries
only `bundle:` and so trips that rule; its content hash is tied into the
sentinels, so fixing it makes a re-compose rewrite the fragments. Tracked
separately.)

## Known · deliberately untouched

- **Neither plugin appears in the `select-plugins` list.** Registration reads only
  a stage's `plugin:` field and a scope's `meta.plugin`, and an overlay is neither.
  **By design, not a defect**, and orthogonal to selection.
- **Drop folders such as `.visual-mockups-plugin/` are not committed to a tree.**
  The compose result already lives in the stage sources and the graph; that folder
  is an input only for running compose *again*.
- **`visual-mockups` deliberately reverses two earlier positions** — it puts the
  plugin back in, and it does touch `.mcp.json`. Note the patch layer itself still
  does not touch `.mcp.json`: the union merge happens only at apply time.
- **`code-map` does not restate the rules.** How to treat a map belongs to
  `aidlc/spaces/<space>/knowledge/aidlc-shared/external-code-map.md`, and the
  delegated personas' **MANDATORY** "Delegated knowledge preflight" reads that
  directory, so the rules already reach 2.1. The plugin ships only WHERE/WHEN (the
  conductor procedure). ⚠️ Landing that knowledge file in the shell is step 3b
  above.
