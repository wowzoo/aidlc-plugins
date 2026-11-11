"""Package a plugin as one zip per harness, each unzipped at an AI-DLC project's root.

WHY THIS EXISTS. AI-DLC has no command a person types to install a plugin. A zip that lands the
plugin inside the harness directory, plus an INSTALL.md the AI follows, works the same way on every
tool: unzip, then one prompt. Where the plugin may sit was measured, not chosen: anything outside
the harness directory can turn a new project brownfield or enter the reverse-engineering scan
(`~/workspaces/labs/aidlc/aidlc-plugin-test/README.md`).

  aidlc-<p>-<v>-claude.zip    .claude/aidlc-plugins/<p>/
  aidlc-<p>-<v>-codex.zip     .codex/aidlc-plugins/<p>/
  aidlc-<p>-<v>-kiro-ide.zip  .kiro/aidlc-plugins/<p>/  + .kiro/hooks/aidlc-<p>-compose.json
  aidlc-<p>-<v>-kiro.zip      .kiro/aidlc-plugins/<p>/

Each plugin folder holds the builder's projection, the plugin's `prerequisites/` and an INSTALL.md
made from `install/<claude-code|codex|kiro>.md`. The builder reads neither `prerequisites/` nor
`install/`, so this script adds them.

usage: package-plugin.py --tools <dir with aidlc-plugin-build.ts> --out <dir>
                         [--harness claude,codex,kiro-ide,kiro] [--plain-name] <plugin-root>...

--plain-name drops the harness from the file name (`aidlc-<p>-<v>.zip`) for a distribution that
ships one harness only; it needs exactly one --harness.
"""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
HARNESSES = ("claude", "codex", "kiro-ide", "kiro")
# harness → (harness directory, install template, product name for the template)
TARGETS = {
    "claude": (".claude", "claude-code.md", "Claude Code"),
    "codex": (".codex", "codex.md", "Codex"),
    "kiro-ide": (".kiro", "kiro.md", "Kiro IDE and Kiro CLI v3"),
    "kiro": (".kiro", "kiro.md", "Kiro CLI V2"),
}


def manifest(root: Path) -> tuple[str, str]:
    data = json.loads((root / ".aidlc-plugin" / "plugin.json").read_text(encoding="utf-8"))
    return data["name"], data["version"]


def run(cmd: list[str]) -> None:
    done = subprocess.run(cmd, capture_output=True, text=True)
    if done.returncode != 0:
        sys.exit(f"failed: {' '.join(cmd)}\n{done.stdout}{done.stderr}")


def zip_name(name: str, version: str, harness: str, plain: bool) -> str:
    return f"aidlc-{name}-{version}.zip" if plain else f"aidlc-{name}-{version}-{harness}.zip"


def install_doc(harness: str, name: str, version: str, zip_file: str) -> str:
    template, product = TARGETS[harness][1:]
    text = (REPO / "install" / template).read_text(encoding="utf-8")
    values = {"PLUGIN": name, "VERSION": version, "HARNESS": harness, "PRODUCT": product, "ZIP": zip_file}
    for key, value in values.items():
        text = text.replace("{{" + key + "}}", value)
    if "{{" in text:
        sys.exit(f"install/{template}: unreplaced placeholder")
    return text


def stage(root: Path, harness: str, tools: Path, work: Path, zip_file: str) -> Path:
    """Build the projection and lay it out as it must land under the project root."""
    name, version = manifest(root)
    hd = TARGETS[harness][0]
    built = work / f"build-{harness}"
    run(["bun", str(tools / "aidlc-plugin-build.ts"), str(root), harness, str(built)])
    tree = work / f"tree-{harness}"
    if harness.startswith("kiro"):
        # The Kiro projection already is `.kiro/aidlc-plugins/<p>/` (+ `.kiro/hooks/` for the IDE).
        shutil.copytree(built / ".kiro", tree / ".kiro")
    else:
        shutil.copytree(built, tree / hd / "aidlc-plugins" / name)
    folder = tree / hd / "aidlc-plugins" / name
    if not (folder / ".aidlc-plugin" / "plugin.json").is_file():
        sys.exit(f"{harness}: projection has no {hd}/aidlc-plugins/{name}/.aidlc-plugin/plugin.json")
    if (root / "prerequisites").is_dir():
        shutil.copytree(root / "prerequisites", folder / "prerequisites")
    (folder / "INSTALL.md").write_text(install_doc(harness, name, version, zip_file), encoding="utf-8")
    return tree


def write_zip(tree: Path, target: Path) -> int:
    files = sorted(p for p in tree.rglob("*") if p.is_file() and p.name != ".DS_Store")
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as z:
        for path in files:
            info = zipfile.ZipInfo(path.relative_to(tree).as_posix(), date_time=(2026, 1, 1, 0, 0, 0))
            info.external_attr = (path.stat().st_mode & 0o777) << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, path.read_bytes())
    return len(files)


def main() -> int:
    args = sys.argv[1:]

    def take(flag: str) -> str | None:
        if flag not in args:
            return None
        i = args.index(flag)
        value = args[i + 1]
        del args[i : i + 2]
        return value

    tools, out, harness_arg = take("--tools"), take("--out"), take("--harness")
    plain = "--plain-name" in args
    if plain:
        args.remove("--plain-name")
    if not tools or not out or not args:
        sys.exit((__doc__ or "").split("usage: ", 1)[-1])
    tools_dir, out_dir = Path(tools).resolve(), Path(out).resolve()
    harnesses = harness_arg.split(",") if harness_arg else list(HARNESSES)
    unknown = [h for h in harnesses if h not in TARGETS]
    if unknown:
        sys.exit(f"unknown harness: {', '.join(unknown)}")
    if plain and len(harnesses) != 1:
        sys.exit("--plain-name needs exactly one --harness: the zip name no longer says which")
    if not (tools_dir / "aidlc-plugin-build.ts").is_file():
        sys.exit(f"no aidlc-plugin-build.ts in {tools_dir}")
    roots = [Path(a).resolve() for a in args]
    for root in roots:
        if out_dir == root or root in out_dir.parents:
            sys.exit(f"--out must be outside the plugin source: {root}")
    out_dir.mkdir(parents=True, exist_ok=True)

    for root in roots:
        name, version = manifest(root)
        run(["bun", str(tools_dir / "aidlc-plugin-validate.ts"), str(root)])
        with tempfile.TemporaryDirectory(prefix=f"pkg-{name}-") as tmp:
            for harness in harnesses:
                target = out_dir / zip_name(name, version, harness, plain)
                tree = stage(root, harness, tools_dir, Path(tmp), target.name)
                count = write_zip(tree, target)
                print(f"{target.name}  {count} files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
