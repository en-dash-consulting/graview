# Graview — Claude Code notes

The project guidance is in `AGENTS.md` and is shared with every assistant:

@AGENTS.md

What is specific to Claude Code:

- **Skills.** The `graview-*` authoring skills in `.claude/skills/` are the
  ones a product installs with `graview skills install .`; here they are the
  source under `packages/skills/skills/`, copied by `pnpm skills`, and a test
  asserts the copies are current. The `ndx-*` skills drive the PRD workflow
  (`/ndx-work`, `/ndx-plan`, `/ndx-status`). Edit a skill at its source,
  never the copy.
- **MCP.** With `ndx start .` running, rex and sourcevision are at
  `http://localhost:3117/mcp/rex` and `/mcp/sourcevision`. When several
  projects are registered on that server the endpoint answers 409 and asks
  for `/p/<id>/...`; that is a connection problem to fix, not a missing tool.
- **Harnesses in a session.** They are long and hold ports; run one chain at
  a time and prefer `pnpm verify <name>` for the claim you touched over the
  whole chain. Playwright's WebKit hangs on `newPage` past 1.49.1 on this
  macOS, which is why the pin exists.
- **Verdicts are files.** After a harness, read `docs/<name>.json` and report
  the claim that failed by name rather than summarising the log.
- **Changesets.** Write one with every package change, `patch` unless told
  otherwise, in the same voice as the existing ones in `.changeset/`.
