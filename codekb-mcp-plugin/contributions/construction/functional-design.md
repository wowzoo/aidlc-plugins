---
target: functional-design
plugin: codekb-mcp-plugin
fragments:
  - anchor: before-step:2
    order: 120
---

## fragment: before-step:2

### Step 1b (codekb-mcp-plugin): Check this unit against the existing code, with the CodeKB service

**This step is conditional.** Run it only when all three hold. Otherwise skip it and go
on as stock:

- this unit changes or calls existing code;
- `aidlc/spaces/<active-space>/knowledge/aidlc-shared/codekb-mcp-spaces.md` names a
  space for a repo the unit touches;
- the `code-knowledge-base` tools are available to you (look them up by name first where
  the harness loads MCP tools on demand).

In ARTIFACT-ONLY mode, skip this step. Step 4 reads its result from the questions file.

The CodeKB service is the code knowledge base behind that MCP server. It is not the
reverse-engineering store, which AI-DLC also calls codekb. Step 1 still reads the store.
Start from what Requirements Analysis already confirmed: the
`## Existing code affected (CodeKB service)` section of `requirements.md`, when it has
one. Check the `freshness` row of each space's `codekb-mcp-space.<repo>.md`. When the
file is missing, compare the indexed commit from `get_space_details` with the repo's
HEAD.

Then run the impact analysis in `{{HARNESS_DIR}}/knowledge/aidlc-shared/codekb-mcp.md`
("Impact analysis") for **this unit only**. Cover the existing entities, rules and flows
the unit's stories change, and the callers of each, across repos when the unit's
contracts cross them. The list from Requirements Analysis is where you start, not the
result: call `show_dependencies(raw_output=true)` on each edit site this unit owns and
read the incoming dependents, because a caller the request-level search did not reach
shows up there. Use `trace_flow` or `get_call_graph_with_source` where a workflow
or state machine in the existing code has to be preserved or changed. Confirm each one
in the local source. When a call fails, follow "When a call fails" in that file and go
on as stock.

Use what you confirmed:

- **Step 2:** at the top of `functional-design-questions.md`, before the questions,
  write a `## Existing code affected (CodeKB service)` section: edit sites as
  `<repo>/<path>:<lines>`, the dependents with their dependency paths, the existing
  workflows, rules or states the unit must keep, and what could not be confirmed. Name
  the space and its freshness. Ask about a dependent only when keeping or changing its
  behaviour is the user's call. A question that comes from this list says so.
- **Step 4:** read that section from the questions file. In `functional-spec.md`, cover
  every confirmed dependent under integration points: kept as is, changed (how), or out
  of scope (why). An existing rule the unit keeps goes into `rules.md` like any other
  rule. Its `source` stays the FR or NFR it serves. The design stays technology-agnostic:
  cite code paths as evidence, do not copy code.
