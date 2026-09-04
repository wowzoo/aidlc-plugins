#!/usr/bin/env python3
"""Narrow a plugin-applied tree's MCP registry to a chosen server set.

`merge-mcp-registry-{kiro,claude}.py` performs the plugin seam's union merge and
lands 7 servers (stock 5 + figma + aws-knowledge-mcp-server). A distribution may
then want fewer than all of them. This driver applies that narrowing:

  - keep only `context7`, `figma`, `aws-knowledge-mcp-server`
    (the four `aws-*` servers stock ships are dropped — each one is a connection
    the target machine would otherwise have to make)
  - give `context7` the `CONTEXT7_API_KEY` header, read from the environment

🔴 This is a POLICY choice, not a defect fix, so it has to be re-applied every
time the tree is rebuilt. It lives in a driver rather than a hand edit precisely
because the merge step is the only one the apply procedure names, which makes this
step easy to forget.

Edit `KEEP` if your distribution wants a different set.

Idempotent. `--check` asserts without writing.

Usage:
  uv run python scripts/apply-mcp-registry-policy.py <tree> [--apply|--check]
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

KEEP = ("context7", "figma", "aws-knowledge-mcp-server")
CONTEXT7_HEADERS = {"CONTEXT7_API_KEY": "${CONTEXT7_API_KEY}"}


def registry_path(tree: Path) -> Path:
    for rel in (".kiro/settings/mcp.json", ".claude/.mcp.json", ".mcp.json"):
        candidate = tree / rel
        if candidate.is_file():
            return candidate
    raise SystemExit(f"{tree}: no MCP registry found")


def main() -> None:
    args = [a for a in sys.argv[1:]]
    if not args:
        raise SystemExit(__doc__)
    tree = Path(args[0])
    check = "--check" in args

    path = registry_path(tree)
    doc = json.loads(path.read_text(encoding="utf-8"))
    servers = doc.get("mcpServers", {})

    dropped = [k for k in servers if k not in KEEP]
    kept = {k: servers[k] for k in KEEP if k in servers}
    missing = [k for k in KEEP if k not in servers]
    if missing:
        raise SystemExit(
            f"{path}: expected servers absent — {missing}. Run the plugin MCP merge first."
        )

    header_needed = kept["context7"].get("headers") != CONTEXT7_HEADERS
    if header_needed:
        kept["context7"] = {**kept["context7"], "headers": CONTEXT7_HEADERS}
        # Keep `disabled` last, matching the shape the stock registry carries.
        if "disabled" in kept["context7"]:
            disabled = kept["context7"].pop("disabled")
            kept["context7"]["disabled"] = disabled

    if not dropped and not header_needed:
        print(f"{path}: already applied ({len(kept)} servers)")
        return
    if check:
        raise SystemExit(
            f"{path}: NOT applied — would drop {dropped or 'nothing'}"
            f"{' and add the context7 header' if header_needed else ''}"
        )

    for key in dropped:
        print(f"  drop: {key}")
    if header_needed:
        print("  add: context7 headers.CONTEXT7_API_KEY")
    doc["mcpServers"] = kept
    path.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"servers {len(servers)} -> {len(kept)}")
    print(f"applied -> {path}")


if __name__ == "__main__":
    main()
