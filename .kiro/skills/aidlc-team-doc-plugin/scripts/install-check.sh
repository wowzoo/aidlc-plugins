#!/usr/bin/env bash
# Validate → test (against a clean install) → build → sync → check, for one AI-DLC plugin stage.
# Judges by artifacts, not exit codes alone: compose prints nothing on success or on a quiet failure.
#
# Usage (all paths absolute; quote them if they contain spaces):
#   SRC="/abs/plugin-src" PROJECT="/abs/project" CLEAN="/abs/clean-install" DIST="/abs/dist" \
#   SLUG="<new stage slug>" SCOPE="feature" LEAF=".kiro" H="kiro-ide" bash install-check.sh
#   (SCOPE defaults to feature. LEAF and H may be omitted; see below.)
#
# LEAF defaults to the one harness folder under PROJECT that holds an AI-DLC install
# (<LEAF>/tools/data/harness.json). A .kiro/ that only holds skills or agents does not count.
# H defaults to the harness that install recorded in that harness.json (kiro-ide, kiro, claude, ...).
# CLEAN, DIST and the build output must not overlap PROJECT in either direction (compared by real
# path, symlinks resolved; neither may contain the other), and the build output must not overlap SRC
# (the builder deletes the output folder before writing it), so a run that
# fails at validate, test or build leaves PROJECT untouched. A failure in the checks AFTER sync
# (drops, doctor, graph) means the plugin is already installed in PROJECT.
# Inherited AIDLC_* / KIRO_* environment variables are cleared first; the ones this script needs are
# set explicitly, so a shell configured for another project cannot redirect any step.
# CLEAN is a fresh install of the same AI-DLC version WITHOUT this plugin; it is created when
# missing. aidlc-plugin-test against a project that already has the plugin fails with
# "collides … not overwritten" — the test tool's limit; sync handles upgrades.
# Nothing is installed into PROJECT unless validate, test and build all pass.
set -u

: "${SRC:?set SRC to the plugin source folder}"
: "${PROJECT:?set PROJECT to the AI-DLC project}"
: "${CLEAN:?set CLEAN to a fresh install path (created if missing)}"
: "${DIST:?set DIST to the build output folder}"
: "${SLUG:?set SLUG to the slug of the stage you added}"
SCOPE="${SCOPE:-feature}"

fail=0
note() { printf '%s\n' "$*"; }
bad()  { printf 'FAIL  %s\n' "$*"; fail=1; }
ok()   { printf 'ok    %s\n' "$*"; }
stop() { note "RESULT: FAIL — $* Stopped before sync; PROJECT was not changed."; exit 1; }

# Paths must be absolute, not the root, and free of "." / ".." components: the overlap check below
# resolves symlinks, and a ".." after a symlink means something different to the shell than to a
# string normaliser, so such paths are refused instead of guessed at.
for name in SRC PROJECT CLEAN DIST; do
  val="${!name}"
  case "$val" in /*) ;; *) note "RESULT: FAIL — $name must be an absolute path: $val"; exit 1 ;; esac
  [ "$val" != "/" ] || { note "RESULT: FAIL — $name must not be /"; exit 1; }
  case "/$val/" in */../*|*/./*) note "RESULT: FAIL — $name must not contain . or .. components: $val"; exit 1 ;; esac
done

# Clear inherited overrides (AIDLC_STAGE_GRAPH, AIDLC_PROJECT_DIR, KIRO_PROJECT_DIR, …).
for v in $(compgen -e | grep -E '^(AIDLC|KIRO)_'); do unset "$v"; done
unset CLAUDE_PROJECT_DIR CLAUDE_PLUGIN_ROOT PLUGIN_ROOT

# CLEAN and DIST outside PROJECT, by real path: resolve the nearest existing ancestor, then append
# the not-yet-created rest. Exit 0 = inside, 1 = outside, 2 = could not resolve (treated as inside).
inside() { bun -e '
  const p = require("path"), fs = require("fs");
  const real = (x) => { let cur = p.resolve(x), rest = [];
    while (!fs.existsSync(cur)) { rest.unshift(p.basename(cur)); const up = p.dirname(cur); if (up === cur) break; cur = up; }
    return p.join(fs.realpathSync(cur), ...rest); };
  try { const a = real(process.argv[1]), b = real(process.argv[2]);
        const rel = p.relative(b, a);
        const up = rel === ".." || rel.startsWith(".." + p.sep);
        process.exit(rel === "" || (!up && !p.isAbsolute(rel)) ? 0 : 1); } catch { process.exit(2); }
' "$1" "$2"; }
# separate A B: succeed only when neither path contains the other (both directions, real paths).
separate() { inside "$1" "$2"; [ $? -eq 1 ] || return 1; inside "$2" "$1"; [ $? -eq 1 ] || return 1; return 0; }
separate "$CLEAN" "$PROJECT" || { note "RESULT: FAIL — CLEAN ($CLEAN) and PROJECT overlap (one contains the other) or could not be resolved; use separate folders."; exit 1; }
separate "$DIST" "$PROJECT"  || { note "RESULT: FAIL — DIST ($DIST) and PROJECT overlap (one contains the other) or could not be resolved; use separate folders."; exit 1; }
separate "$CLEAN" "$DIST"    || { note "RESULT: FAIL — CLEAN and DIST overlap; use separate folders."; exit 1; }

if [ -z "${LEAF:-}" ]; then
  found=""
  for l in .kiro .claude; do [ -f "$PROJECT/$l/tools/data/harness.json" ] && found="$found $l"; done
  set -- $found
  [ "$#" -eq 1 ] || stop "found AI-DLC installs in:${found:- none}; set LEAF."
  LEAF="$1"
fi
[ -f "$PROJECT/$LEAF/tools/data/harness.json" ] || stop "no AI-DLC install under $PROJECT/$LEAF (tools/data/harness.json missing)."
T="$PROJECT/$LEAF/tools"
if [ -z "${H:-}" ]; then
  H="$(bun -e 'try{console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).name||"")}catch{console.log("")}' "$T/data/harness.json")"
  [ -n "$H" ] || stop "cannot read the harness name from $T/data/harness.json; set H."
fi
[ -f "$SRC/.aidlc-plugin/plugin.json" ] || stop "no .aidlc-plugin/plugin.json under SRC ($SRC)."

# The build output: the builder deletes it before writing (its own earlier output only), so it must
# not hold or sit inside SRC, and must stay out of PROJECT.
NAME="$(bun -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).name)' "$SRC/.aidlc-plugin/plugin.json")"
OUT="$DIST/$NAME/$H"
separate "$OUT" "$PROJECT" || stop "the build output ($OUT) and PROJECT overlap (one contains the other) or could not be resolved; choose another DIST."
separate "$OUT" "$SRC"     || stop "the build output ($OUT) and SRC overlap (one contains the other) or could not be resolved; keep DIST outside the plugin source."

# Every aidlc command below targets PROJECT, whatever the calling shell had set.
export AIDLC_PROJECT_DIR="$PROJECT" CLAUDE_PROJECT_DIR="$PROJECT" KIRO_PROJECT_DIR="$PROJECT" \
       AIDLC_HARNESS_DIR="$LEAF" AIDLC_HARNESS_NAME="$H"
cd "$PROJECT" || exit 1
note "project: $PROJECT   harness: $H ($LEAF)   aidlc: $(aidlc --version 2>/dev/null | head -1)"

if [ ! -d "$CLEAN/$LEAF" ]; then
  note "creating clean install at $CLEAN"
  mkdir -p "$CLEAN" && aidlc config --project-dir "$CLEAN" --harness "$H" --yes >/dev/null || stop "aidlc config for CLEAN failed."
fi

# 1. validate and test — stop before building on any failure
out="$(bun "$T/aidlc-plugin-validate.ts" "$SRC" 2>&1)"
printf '%s\n' "$out" | grep -q "Plugin validation: VALID" && ok "validate VALID" || { bad "validate"; printf '%s\n' "$out" | grep -E "ERROR|rule" | head -20; }
out="$(AIDLC_PROJECT_DIR="$CLEAN" CLAUDE_PROJECT_DIR="$CLEAN" KIRO_PROJECT_DIR="$CLEAN" bun "$T/aidlc-plugin-test.ts" "$SRC" --install "$CLEAN" --harness "$H" 2>&1)"
printf '%s\n' "$out" | grep -q "Plugin test: CLEAN" && ok "test CLEAN (against CLEAN)" || { bad "test"; printf '%s\n' "$out" | grep -E "ERROR|Drops|collides" | head -20; }
[ "$fail" -eq 0 ] || stop "validate or test failed; nothing was built."

# 2. build — the builder replaces its own earlier output and refuses a folder it does not own
out="$(bun "$T/aidlc-plugin-build.ts" "$SRC" "$H" "$OUT" 2>&1)"; rc=$?
if [ "$rc" -eq 0 ] && printf '%s\n' "$out" | grep -q "Plugin build: COMPLETE"; then ok "build → $OUT"; else bad "build (exit $rc)"; printf '%s\n' "$out" | tail -10; stop "build failed."; fi

# 3. install
out="$(AIDLC_PLUGIN_ROOT="$OUT" aidlc engine plugin sync --yes 2>&1)"; src=$?
if [ "$src" -eq 0 ] && printf '%s\n' "$out" | grep -q "plugin sync complete"; then
  ok "sync"
else
  bad "sync (exit $src)"; printf '%s\n' "$out" | tail -10
  note "RESULT: FAIL — sync failed. sync composes in a staging copy and applies to PROJECT only after it succeeds, so PROJECT normally keeps its previous state; check the error above."
  exit 1
fi

# 4. check — by artifacts
drops_list="$(mktemp)"
if find "$PROJECT" -name '*.drops' -print0 > "$drops_list" 2>/dev/null; then
  if [ -s "$drops_list" ]; then
    bad "drops present:"
    while IFS= read -r -d '' f; do printf '  %s\n' "$f"; sed 's/^/    /' "$f"; done < "$drops_list"
  else
    ok "drops 0"
  fi
else
  bad "could not search PROJECT for *.drops"
fi
rm -f "$drops_list"

doc="$(aidlc doctor 2>&1)"
line="$(printf '%s\n' "$doc" | grep -E '^[0-9]+ problems?,' | tail -1)"
printf '%s\n' "$line" | grep -q "^0 problems" && ok "doctor: $line" || { bad "doctor: ${line:-no summary line}"; printf '%s\n' "$doc" | grep -E "^\s+fail" | head -20; }
printf '%s\n' "$doc" | grep -E "^\s+warn" | sed 's/^/      /'

order="$(aidlc engine graph scope "$SCOPE" 2>&1)"; grc=$?
if [ "$grc" -ne 0 ]; then
  bad "aidlc engine graph scope $SCOPE failed: $(printf '%s\n' "$order" | tail -1)"
elif ! printf '%s\n' "$order" | grep -qx "$SLUG"; then
  bad "$SLUG is not in scope $SCOPE (check the stage's scopes:)"
else
  verdict="$(printf '%s\n' "$order" | bun -e '
    const fs = require("fs");
    const [graphPath, slug] = process.argv.slice(1);
    const graph = JSON.parse(fs.readFileSync(graphPath, "utf8"));
    const bySlug = new Map(graph.map((s) => [s.slug, s]));
    const order = fs.readFileSync(0, "utf8").split("\n").map((l) => l.trim()).filter((l) => bySlug.has(l));
    const me = bySlug.get(slug); const i = order.indexOf(slug);
    const laterCore = order.slice(i + 1).filter((s) => bySlug.get(s).phase === me.phase && !bySlug.get(s).plugin);
    console.log(laterCore.length === 0
      ? `ok ${me.number} (${me.phase}); before: ${order[i - 1] ?? "-"}; after: ${order[i + 1] ?? "-"}`
      : `bad core stages of ${me.phase} run after it: ${laterCore.join(", ")}`);
  ' "$T/data/stage-graph.json" "$SLUG")"
  case "$verdict" in
    ok\ *) ok "graph scope $SCOPE: $SLUG at ${verdict#ok }" ;;
    *) bad "graph scope $SCOPE: ${verdict#bad }" ;;
  esac
fi

[ "$fail" -eq 0 ] && note "RESULT: PASS" || note "RESULT: FAIL — the plugin IS installed in PROJECT; fix and re-run (sync upgrades it in place)."
exit "$fail"
