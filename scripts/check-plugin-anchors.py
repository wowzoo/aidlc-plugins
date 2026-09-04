"""Check the `visual-mockups` contribution anchors against a tree — before and after compose.

WHY THIS EXISTS. A contribution splices prose at a `### Step N` anchor. When upstream
renumbers a stage's steps, compose still lands the `adds` (produces/consumes) but drops
the prose fragment with a log line — exit 0, silent half-application. Removing one early
step from a stage shifts every number after it: one anchor is left with nothing to bind
to, and another still resolves but binds to the WRONG step (an approval or handoff step
instead of the artifact-writing one). Absolute expectations ("every file has 7 steps",
"9 after compose") cannot see that: they go stale the same generation they are written.

So both checks here are derived, never hardcoded:
  --pre   every anchor DECLARED in the authoring form resolves in the compose base.
  --post  every contribution's fragments landed: sentinel pairs present, and the step
          headings the plugin OWNS (the ones inside a sentinel block) match the number
          of fragments it declares.

Shared by the kiro and claude tracks on purpose: the authoring form is one, and the only
harness-specific part is the engine directory, which is detected from the tree. This is
the same reasoning that keeps `apply_external_code_map.py` shared.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

# 🔴 The plugin name is NOT a constant — this workspace ships more than one plugin
# (`visual-mockups`, `code-map`). It is read from the plugin root's own manifest so a
# second plugin cannot be checked against the first one's sentinel.
def plugin_name(root: Path) -> str:
    import json
    mf = root / ".aidlc-plugin" / "plugin.json"
    if mf.is_file():
        try:
            n = json.loads(mf.read_text(encoding="utf-8")).get("name")
            if isinstance(n, str) and n.strip():
                return n.strip()
        except json.JSONDecodeError:
            pass
    return root.name
STEP_RE = re.compile(r"^### Step [0-9]", re.MULTILINE)
ANCHOR_RE = re.compile(r"^\s*-\s*anchor:\s*(before|after)-step:(\d+)\s*$", re.MULTILINE)
FRAGMENT_RE = re.compile(r"^## fragment:\s*(before|after)-step:(\d+)\s*$", re.MULTILINE)


def engine_dir(tree: Path) -> str:
    for cand in (".kiro", ".claude"):
        if (tree / cand / "aidlc-common").is_dir():
            return cand
    sys.exit(f"엔진 디렉터리를 못 찾음: {tree}")


def contributions(root: Path) -> dict[str, tuple[Path, list[tuple[str, int]]]]:
    """{stage-rel-path: (contribution file, declared anchors)} from the authoring form."""
    out: dict[str, tuple[Path, list[tuple[str, int]]]] = {}
    for f in sorted((root / "contributions").rglob("*.md")):
        rel = f.relative_to(root / "contributions").as_posix()
        declared = [(k, int(n)) for k, n in ANCHOR_RE.findall(f.read_text(encoding="utf-8"))]
        frags = [(k, int(n)) for k, n in FRAGMENT_RE.findall(f.read_text(encoding="utf-8"))]
        if declared != frags:
            sys.exit(
                f"REFUSED — {f}: frontmatter anchors {declared} != fragment headings {frags}. "
                "정본 안에서 이미 어긋났다."
            )
        out[rel] = (f, declared)
    return out


def steps_in(path: Path) -> dict[int, str]:
    """{step number: its title}. The TITLE is what an anchor actually means."""
    return {
        int(n): title.strip(" :")
        for n, title in re.findall(
            r"^### Step (\d+)([^\n]*)", path.read_text(encoding="utf-8"), re.MULTILINE
        )
    }


def pre(tree: Path, root: Path) -> int:
    eng = engine_dir(tree)
    bad = 0
    for rel, (_src, anchors) in contributions(root).items():
        stage = tree / eng / "aidlc-common" / "stages" / rel
        if not stage.is_file():
            print(f"  🔴 MISSING STAGE  {rel}")
            bad += 1
            continue
        have = steps_in(stage)
        miss = [f"{k}-step:{n}" for k, n in anchors if n not in have]
        mark = "OK  " if not miss else "🔴 "
        # Print the anchored step's TITLE, not just its number. A renumbering can leave
        # an anchor RESOLVING against the wrong step — e.g. binding `after-step:5` to a
        # "Completion Handoff" instead of "Generate Artifacts" — and no number-only check
        # can see that. The title is the thing a human compares.
        bound = ", ".join(
            f"{k}-step:{n}→{have.get(n, '<UNRESOLVED>')}" for k, n in anchors
        )
        print(f"  {mark}{rel:<44} {bound}")
        bad += len(miss)
    if bad:
        print(
            f"\nFAIL — {bad} anchor(s) do not resolve. 고치는 곳은 트리가 아니라 정본이다:\n"
            f"  {root}/contributions/**  의 `- anchor:` 와 `## fragment:` 를 새 번호로 옮긴다."
        )
        return 1
    print(
        "\nPASS — every declared anchor resolves in this base.\n"
        "⚠️ READ THE TITLES ABOVE. Resolving is not the same as binding to the RIGHT step: a\n"
        "   renumbering can shift the meaning while the number still exists. The intended\n"
        "   targets are the artifact-writing step and the approval step of each stage."
    )
    return 0


def post(tree: Path, root: Path) -> int:
    sentinel = f"plugin:{plugin_name(root)}"
    eng = engine_dir(tree)
    bad = 0
    for rel, (_src, anchors) in contributions(root).items():
        stage = tree / eng / "aidlc-common" / "stages" / rel
        txt = stage.read_text(encoding="utf-8")
        want_sentinels = 2 * len(anchors)  # open + close per fragment
        got_sentinels = txt.count(sentinel)
        owned = sum(
            len(STEP_RE.findall(block))
            for block in re.findall(
                rf"<!-- {re.escape(sentinel)}:.*?-->\n(.*?)<!-- /{re.escape(sentinel)}:",
                txt,
                re.DOTALL,
            )
        )
        ok = got_sentinels == want_sentinels and owned == len(anchors)
        bad += 0 if ok else 1
        print(
            f"  {'OK  ' if ok else '🔴 '}{rel:<44} sentinel={got_sentinels}/{want_sentinels} "
            f"owned-step={owned}/{len(anchors)} total-step={len(STEP_RE.findall(txt))}"
        )
    if bad:
        print(
            f"\nFAIL — {bad} file(s) carry a partial splice. compose 는 exit 0 을 낸다: "
            "판정은 이 표다."
        )
        return 1
    print("\nPASS — every fragment landed. (total-step is the host's own numbering — never a gate.)")
    return 0


def main() -> int:
    args = sys.argv[1:]
    if len(args) < 2 or args[0] not in ("--pre", "--post"):
        sys.exit(
            "usage: check-plugin-anchors.py --pre|--post <tree> "
            "[--plugin-root <visual-mockups>]"
        )
    mode, tree = args[0], Path(args[1])
    root = (
        Path(args[args.index("--plugin-root") + 1])
        if "--plugin-root" in args
        else Path("visual-mockups")
    )
    print(f"{tree}  ({engine_dir(tree)})  ← {root}")
    return pre(tree, root) if mode == "--pre" else post(tree, root)


if __name__ == "__main__":
    raise SystemExit(main())
