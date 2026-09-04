"""Merge our MCP server entries into the claude tree's ROOT `.mcp.json`, key-wise.

    uv run python scripts/merge-mcp-registry-claude.py <tree> --src <mcp.json> [--apply]

`--src` is the registry holding the entries to add. It is owned by the installer's
asset tree, not by this repository.

Union with NO override: an entry whose name the tree already carries is left
alone, because the stock registry's five servers are an upstream decision and
this layer only adds the two the Figma path needs.

🔴 Two things are specific to THIS harness and are measured on it, not carried
over from the kiro side:

1. The registry lives at the tree ROOT (`.mcp.json`), not under the engine dir.
2. **No `disabled` key is written.** Stock's five entries carry no such key, so
   introducing one would plant a foreign convention in a file this layer is
   supposed to touch minimally. Claude Code prompts for approval before running a
   project `.mcp.json` server — the pre-approval key that would bypass that prompt
   is `enabledMcpjsonServers` in `settings.json`, which is deliberately not used
   here. So adding an entry does not silently enable a server.

Why not `json.load` + `json.dump`: a round trip reformats all five stock entries
(the tree keeps `"args": ["…"]` on one line, json.dump does not) and the diff then
covers the whole file instead of the two keys we added. So the new blocks are
built from the source entries and spliced in as text.

Idempotent: an already-merged tree reports every key as present and writes nothing.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

REL = ".mcp.json"
INDENT = "    "  # stock nests servers two levels deep


def render(name: str, entry: dict) -> str:
    """One `"name": { … }` block in the stock file's shape, `disabled` dropped."""
    body = {k: v for k, v in entry.items() if k != "disabled"}
    lines = [f'{INDENT}"{name}": {{']
    items = list(body.items())
    for i, (k, v) in enumerate(items):
        tail = "" if i == len(items) - 1 else ","
        if isinstance(v, list):
            inner = ", ".join(json.dumps(x, ensure_ascii=False) for x in v)
            lines.append(f'{INDENT}  "{k}": [{inner}]{tail}')
        else:
            lines.append(f'{INDENT}  "{k}": {json.dumps(v, ensure_ascii=False)}{tail}')
    lines.append(f"{INDENT}}}")
    return "\n".join(lines)


def main() -> int:
    argv = sys.argv[1:]
    if not argv or "--src" not in argv:
        raise SystemExit(__doc__)
    tree = Path(argv[0])
    src = Path(argv[argv.index("--src") + 1])
    apply_it = "--apply" in argv

    target = tree / REL
    if not target.exists():
        raise SystemExit(f"FAIL: no {REL} in {tree} — is this a claude tree?")
    text = target.read_text(encoding="utf-8")
    have = json.loads(text)["mcpServers"]
    want = json.loads(src.read_text(encoding="utf-8"))["mcpServers"]

    if any("disabled" in v for v in have.values()):
        raise SystemExit(
            "FAIL: stock entries now carry `disabled` — re-decide the convention "
            "before merging (this driver deliberately writes none)."
        )

    add = []
    for key in want:
        if key in have:
            print(f"  skip (no override, ever): {key}")
        else:
            add.append(key)
            print(f"  add: {key}   (disabled dropped: {'disabled' in want[key]})")
    if not add:
        print("nothing to merge")
        return 0

    tail = "\n  }\n}"
    if not text.rstrip("\n").endswith(tail.strip("\n")):
        raise SystemExit("FAIL: unexpected file tail; merge by hand")
    cut = text.rindex(tail)
    spliced = (
        text[:cut] + ",\n" + ",\n".join(render(k, want[k]) for k in add) + text[cut:]
    )

    after = json.loads(spliced)["mcpServers"]  # parse guard
    if any(after[k] != have[k] for k in have):
        raise SystemExit("FAIL: a stock entry changed — refusing to write")
    print(f"servers {len(have)} -> {len(after)}")
    if apply_it:
        target.write_text(spliced, encoding="utf-8")
        print(f"applied -> {target}")
    else:
        print("dry run")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
