"""Merge our MCP server entries into a tree's `.kiro/settings/mcp.json`, key-wise.

The rule is union with NO override: an entry whose name the tree already carries is
left alone, because the stock registry's five servers are an upstream decision and
this layer only adds the two the visual-mockups path needs.

Why not `json.load` + `json.dump`: a round trip reformats all five stock entries
(the tree keeps `"args": ["…"]` on one line, json.dump does not) and the diff then
covers the whole file instead of the two keys we added. So the new blocks are lifted
VERBATIM out of the source file by brace matching and spliced in as text.

    uv run python scripts/merge-mcp-registry-kiro.py <tree-root> --src <mcp.json> [--apply]

`--src` is the registry holding the entries to add. It is owned by the installer's
asset tree, not by this repository.

Idempotent: an already-merged tree reports every key as present and writes nothing.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

REL = ".kiro/settings/mcp.json"


def block(text: str, key: str) -> str:
    """The verbatim `"key": { … }` span, including its own indentation."""
    marker = f'"{key}":'
    i = text.index(marker)
    line_start = text.rindex("\n", 0, i) + 1
    j = text.index("{", i)
    depth = 0
    for k in range(j, len(text)):
        if text[k] == "{":
            depth += 1
        elif text[k] == "}":
            depth -= 1
            if depth == 0:
                return text[line_start : k + 1]
    raise SystemExit(f"FAIL: unbalanced braces for {key}")


def main() -> int:
    argv = sys.argv[1:]
    if not argv or "--src" not in argv:
        raise SystemExit(__doc__)
    tree = Path(argv[0])
    src = Path(argv[argv.index("--src") + 1])
    apply_it = "--apply" in argv

    target = tree / REL
    text = target.read_text()
    src_text = src.read_text()
    have = set(json.loads(text)["mcpServers"])
    want = json.loads(src_text)["mcpServers"]

    add = []
    for key in want:
        if key in have:
            print(f"  skip (no override, ever): {key}")
        else:
            add.append(key)
            print(f"  add: {key}")
    if not add:
        print("nothing to merge")
        return 0

    # Splice before the close of the `mcpServers` object: the last `}` that is
    # followed only by the two closing braces of the file.
    tail = "\n  }\n}"
    if not text.rstrip("\n").endswith(tail.strip("\n")):
        raise SystemExit("FAIL: unexpected file tail; merge by hand")
    cut = text.rindex(tail)
    spliced = text[:cut] + ",\n" + ",\n".join(block(src_text, k) for k in add) + text[cut:]

    json.loads(spliced)  # parse guard: never write something unreadable
    after = set(json.loads(spliced)["mcpServers"])
    print(f"servers {len(have)} -> {len(after)}")
    if apply_it:
        target.write_text(spliced)
        print(f"applied -> {target}")
    else:
        print("dry run")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
