---
target: requirements-analysis
plugin: codekb-mcp-plugin
fragments:
  - anchor: before-step:3
    order: 120
---

## fragment: before-step:3

### Step 2b (codekb-mcp-plugin): Find the existing code this request touches, with the CodeKB service

**This step is conditional.** Run it only when all three hold. Otherwise skip it and go
on as stock:

- the project is brownfield;
- `aidlc/spaces/<active-space>/knowledge/aidlc-shared/codekb-mcp-spaces.md` names at
  least one space for a repo this intent touches;
- the `code-knowledge-base` tools are available to you (look them up by name first where
  the harness loads MCP tools on demand).

The CodeKB service is the code knowledge base behind that MCP server. It is not the
reverse-engineering store, which AI-DLC also calls codekb. Keep reading the store as
Step 1 says. The service adds where a change lands and what depends on it.

Before you rely on a space, read its `codekb-mcp-space.<repo>.md` `freshness` row. When
the file is missing (the repo was reused, not scanned, in this intent), call
`get_space_details` and compare the indexed commit with the repo's HEAD yourself.

Run the impact analysis in `{{HARNESS_DIR}}/knowledge/aidlc-shared/codekb-mcp.md`
("Impact analysis") on the request as Step 2 understood it. Scope the search to the
hyperspace in `codekb-mcp-spaces.md`, or to the spaces it lists for this intent's repos.
Stay at the depth the request needs: a narrow change needs its edit sites and direct
dependents, not a map of the system. When a call fails, follow "When a call fails" in
that file and go on as stock.

Use what you confirmed:

- **Steps 2–3:** the number of repos and components the change reaches is evidence for
  Scope and Complexity. Say in one line what it changed in your depth choice.
- **Step 5:** confirmed dependents are Technical context (integration points). An
  affected component the request does not mention is a gap to raise.
- **Step 6:** at the top of `requirements-analysis-questions.md`, before the questions,
  write a `## Existing code affected (CodeKB service)` section. List the edit sites and
  affected components as `<repo>/<path>:<lines>`, each with its dependency path, and
  under it the ones that looked affected but could not be confirmed. Name the space and
  its freshness. A question that comes from this list says so. The file keeps the list
  across turns, and Step 10 reads it from there.
- **Step 10:** carry that section into `requirements.md` under the same heading, after
  **Constraints**. Requirements still state behaviour, not code. The section is the
  evidence for scope, and every path in it is one you read.

When nothing is confirmed, write the section with "none confirmed" and the searches you
ran, so the next stage does not repeat them.
