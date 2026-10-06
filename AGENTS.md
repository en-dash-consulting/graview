# Graview

A framework for building applications where a typed context graph **is** the
interface rather than the backing store. A product declares its node kinds —
fields, edges, views, mutations, invariants, roles — once, in TypeScript, and
the framework derives the spatial scene, the routed pages, the legal actions,
the agent tool surface and the accessibility labels from that declaration.

`graview` is the tool a person installs. `@graview/*` is the framework a
product imports. All fourteen packages share one version.

## Layout

```
packages/
  graview/         graview              the one CLI: create, check, docs, describe, lens, figure, serve, skills
  create-graview/  create-graview       `npm create graview` — a three-line door to `graview create`
  core/            @graview/core        schema, graph, invariants, op log, adapters, the checker, the scaffolder
  layout/          @graview/layout      positions and planes — headless, pure
  tools/           @graview/tools       derived affordances, one agent tool surface
  render/          @graview/render      DOM renderer (ships); GPU capture path behind ./gpu (experimental)
  react/           @graview/react       the only UI binding, deliberately thin
  primitives/      @graview/primitives  view primitives, the lenses, the workbench, the Shell
  pages/           @graview/pages       the routed face, derived from the same declaration
  ship/            @graview/ship        persistence, op-log-native migrations, export, health, `serve`
  studio/          @graview/studio      the declaration itself as a graph, edited in Graview's own interface
  embed/           @graview/embed       mount an app into any element without the Shell
  guest/           @graview/guest       a view somebody else wrote, in a sandboxed frame that can only ask
  skills/          @graview/skills      the authoring skills an assistant installs into a product
apps/
  todo/            THE EXAMPLE — the one the docs teach from
  seedbed/         the example that starts empty, and the chapters on docs/site
  rota/            a volunteer rota: the served store, the calendar, three seats
  launcher/        the desk — a Graview app whose subject is the other apps
  promo/           the promotional site
  spike/           platform capability validation against a real browser
scripts/           verify-*.mjs browser harnesses, smoke-*.mjs packaging rehearsals, site-*.mjs docs build
docs/              harness verdicts (*.json), the docs site (site/), walkthrough findings
```

**The packages are what ships. The apps are examples and fixtures** —
changesets ignores them, and a real product lives in its own repository and
consumes the packages the way a stranger would.

## Dependency rules

These are pinned by tests, not by convention:

- **The domain tier must not import React.** A declaration (`defineApp`,
  `defineNode`, mutations, invariants) runs in Node for `graview check` and
  in a page alike. Pictures are a separate module (`--views`).
- **`@graview/render`'s main entry is pure geometry.** Only `./gpu` touches
  WebGPU, so importing render does not inherit a WebGPU type dependency.
- **`@graview/ship/browser` reaches no `node:` builtin and no shebang**
  (`packages/ship/tests/unit/the-browser-entry.test.ts`). The Node half —
  file adapter, server — is reached only from the main entry and `./cli`.
- **Products never install zod.** `@graview/core` re-exports `z`; a second
  copy makes every kind's fields a nominally different type and tsc exhausts
  its heap instead of saying so.
- **Every subcommand lives in the package whose concern it is.** `graview`
  (`packages/graview/src/index.ts`) only dispatches: `serve` to
  `@graview/ship/cli`, `skills` to `@graview/skills/cli`, everything else
  to `@graview/core/cli`. Do not add a bin to core, ship or skills.
- **A linked project needs every package in `LINKED_PACKAGES` built**
  (`packages/core/src/scaffold/project.ts`) — that is `GRAVIEW_PACKAGES`
  plus `skills` and `graview`. Add a package a product depends on to
  `GRAVIEW_PACKAGES`; the scaffolder writes it into new projects.
- **`@graview/core` and `@graview/core/document` carry only what a page
  draws with.** A hosted page imports both up front, so the checker
  (`checkApp`, `compileDocument`, `describeApp`) lives on
  `@graview/core/check`, the city and `sceneThumbnail` on `/scene`, the
  shipped drawings on `/figures`, a view's block resolver on `/blocks`,
  a status board's reach on `/describe`, and arranging a list on `/arrange`
  (`packages/core/tests/unit/the-main-entry-carries-only-what-a-page-draws-with.test.ts`).
  Likewise what only a drawn view uses is `@graview/react/drawing`'s, not
  `/provider`'s, and `@graview/tools/edit`'s, not `/frame`'s
  (`packages/react/tests/unit/the-provider-carries-only-what-the-frame-draws-with.test.ts`).
  The hosted page's first load has a budget (`tests/a-hosted-page-keeps-to-its-budget.test.ts`).

## Commands

```sh
pnpm install && pnpm build     # the framework; apps typecheck against dist/
pnpm test                      # vitest, headless: no GPU, no browser
pnpm typecheck                 # packages, apps, and every package's tests (tsconfig.tests.json)
pnpm check                     # graview check against every app's declaration
pnpm verify                    # every browser harness, 3 side by side then the timing ones alone (~10 min)
pnpm verify <name> [<name>]    # only these harnesses (pnpm verify --list)
pnpm verify --failed           # only what failed last time
pnpm verify --quick            # fewer widths, schemes and seats where a harness sweeps them
GRAVIEW_SLOW=4 pnpm verify <name>  # every page's CPU throttled like the nightly's runner

pnpm dev                       # apps/todo → http://localhost:5193
pnpm apps                      # the desk → http://localhost:5199 (opens the others in place)
pnpm graview -- <args>         # the CLI from this checkout

pnpm pack:inspect              # what goes in each tarball (docs/pack.json)
pnpm smoke                     # install the tarballs into a scratch app and build it
pnpm smoke:create              # graview create → install → its own verify → a real browser
pnpm site:build:all            # regenerate docs/site (css, numbers, docs pages)
pnpm skills                    # install the authoring skills into .claude/skills and .agents/skills
```

The harnesses drive dev servers on fixed ports, so run **one harness chain
at a time** per checkout; a second checkout (a worktree) runs its servers
outside 5190–5289 by setting `GRAVIEW_PORT_BASE` (5600 puts todo on 5603:
every port moves to base + (port − 5190), through `scripts/lib/ports.mjs`,
and no harness writes a port of its own; the apps' vite configs move
with it, and the desk links to and probes the moved ports), and a harness only borrows a
server that serves its own checkout. Each writes its verdict to `docs/*.json` as named claims; when one
fails it names the claim that stopped being true. Every page every harness
opens is also judged by the watch (`scripts/lib/watch.mjs`) — the keyboard
never left on `<body>`, no declared id shown to a person, no act offered
then refused, no page error — and the ledger (`docs/watch/ledger.json`)
keeps each problem once across harnesses and runs: a run ends by saying
what is new, still open, fixed, and back after a fix. `tests/site.test.ts`
checks that `docs/site` matches the tree — after changing package
descriptions, skills or test counts, run `pnpm site:build:all`.

Run `npx playwright install chromium webkit firefox` once. Playwright is
pinned at 1.49.1 on purpose.

## Conventions

- **Every change under `packages/` carries a changeset** (`pnpm changeset`;
  CI refuses a pull request without one). **Bumps default to `patch`.** The
  packages are one changesets `fixed` group.
- **Verify before claiming.** A skill or a change that says "it works" runs
  `graview check`, the tests, and the harness that covers the claim, and
  reports what they actually said.
- **Names say what a thing is.** Commit messages, changesets and harness
  claims are sentences a stranger can read (see `git log`); tests are named
  for the claim they hold.
- **Pre-1.0 the shape changes outright.** No compatibility shims or
  deprecated aliases for a package nobody depends on yet; the changelog
  records the change.
- **Public API is `src/index.ts` → `exports` in `package.json`**, with the
  entries listed there (core's `./document`, `./check`, `./scene`,
  `./figures`, `./blocks`, `./describe`, `./arrange`, `./conformance`, `./scaffold`,
  `./testing`; layout's `./view`; react's `./provider` and `./drawing`;
  tools' `./frame` and `./edit`; embed's `./pages`;
  `./cli`, `./browser`, `./dev`, `./gpu`, `./sqlite` and the rest). `files` is an allowlist and
  `scripts/inspect-pack.mjs` asserts against the real tarball.
- **Node 22.** Top-level await in the scaffolded app, and the engines field
  on every package.

## Releasing

`.github/workflows/release.yml` turns merged changesets into a "Version
packages" pull request (and dispatches CI on it, since a pull request the
workflow's own token opens starts none). Merging it starts the `publish` job,
which **waits in the `npm` environment for its required reviewer to approve
it once in GitHub** — that one approval releases all fourteen packages. The
job then builds, tests, checks the last Nightly on main is green, publishes
each package by npm trusted publishing (`scripts/release-publish.mjs`), tags
`<name>@<version>` and writes a GitHub release each. Re-running the job
finishes a release that stopped part way. Each package's trusted publisher on
npmjs.com names repository `en-dash-consulting/graview`, workflow
`release.yml`, environment `npm`, and allows publish;
`pnpm release:trust --apply` (npm 12, logged in as an owner) sets that. A
brand-new package can't have a trusted publisher until it exists, so its
first version is published by hand.

The `publish` job runs only when no changeset is pending, so a Version
packages merge followed by more changesets is released with the next one:
0.1.13 was versioned and never published, and ships inside 0.1.14. Each
GitHub release's notes carry the changelog sections of the versions before
it that npm never had. A `Compatibility:` line on every changeset that
touches a surface (`scripts/lib/surfaces.mjs`) is what `docs/stability.md`
promises a host, and `capabilities().shipped` names the FR ids the
changesets announce.

`main` is protected by a ruleset: changes arrive by pull request, `verify`
and `changeset` must pass, and nothing force-pushes or deletes it.
License: Elastic License 2.0, at the root and in every tarball.

## Key files

| Path | Purpose |
|------|---------|
| `packages/graview/src/index.ts` | The CLI dispatcher — the only place subcommands are wired |
| `packages/core/src/cli/` | `check`, `create`, `docs`, `describe`, `lens`, `figure` |
| `packages/core/src/scaffold/` | What `graview create` writes; `project.ts` holds the manifest and the package lists |
| `packages/skills/skills/*/SKILL.md` | The authoring skills a product installs |
| `scripts/verify-all.mjs` | The harness chain, cheapest first |
| `scripts/lib/tarballs.mjs` | Pack and pin the workspace as a stranger would receive it |
| `docs/site/` | The docs site; `docs/site/chapters.js` is built from `apps/seedbed` |
| `docs/walkthrough.md` | The stage-by-stage walk from `graview create` to a seamless app, with findings |
| `.changeset/README.md` | The versioning convention |
| `docs/stability.md` | What a version may change on the five surfaces a host holds it to |
| `scripts/lib/ports.mjs` | Every port a harness serves on, moved together by `GRAVIEW_PORT_BASE` |

## Project management tooling (n-dx)

This repository is developed with [n-dx](https://github.com/en-dash-consulting/n-dx)
(0.8, the `.ndx/` layout):
the PRD, the analysis and the run history live in the tree and are part of
the project's record. They are not published — no package's `files` reaches
them — but they are the context for what was built and why.

| Path | What it is |
|------|------------|
| `.ndx/rex/prd_tree/` | The PRD: one directory per epic/feature/task with an `index.md`; the sole writable PRD surface |
| `.ndx/rex/workflow.md` | Project-specific task-execution rules appended to the n-dx workflow |
| `.ndx/config.json`, `.ndx/rex/config.json`, `.ndx/hench/config.json` | Tool configuration (model, guard, ports) |
| `.ndx/hench/runs/*.json` | One record per autonomous run: task, status, summary, token usage |
| `.ndx/sourcevision/` | Static analysis: zones, imports, findings, `CONTEXT.md` |
| `.claude/skills/`, `.agents/skills/` | Installed skills: the `graview-*` authoring skills plus the `ndx-*` workflow skills |

Commands: `ndx status .` (progress), `ndx plan .` (analyze and propose PRD
updates), `ndx work .` (execute the next task), `ndx start .` (dashboard and
MCP endpoints on port 3117). Rex and sourcevision expose MCP servers; over
HTTP once `ndx start` is running, or over stdio via
`node <n-dx>/packages/rex/dist/cli/index.js mcp .` — Codex reads
`.codex/config.toml`, which `ndx init` writes with machine-specific paths and
which is therefore gitignored.

**Rex MCP tools** — read: `get_prd_status`, `get_next_task`, `get_item`,
`get_recommendations`, `get_token_usage`, `health`, `facets`,
`get_capabilities`; write (folder tree only): `claim_task`, `release_task`, `update_task_status`,
`add_item`, `edit_item`, `move_item`, `merge_items`, `append_log`,
`verify_criteria`, `reorganize`, `sync_with_remote`.

**Sourcevision MCP tools** — read: `get_overview`, `get_next_steps`,
`get_zone`, `get_findings`, `get_file_info`, `search_files`, `get_imports`,
`get_classifications`, `get_route_tree`; write: `set_file_archetype`.

Rules that matter here:

- **One PRD writer at a time.** MCP writes and CLI commands that rewrite
  the tree (`plan`, `reorganize`, `prune`, `reshape`) must not overlap; the
  last writer wins silently.
- **One task per autonomous run.** Pick it with `get_next_task` and hold it
  with `claim_task` (another worktree's agent then skips it), read its
  parent chain and acceptance criteria, implement with a failing test first
  where possible, run `pnpm test` and the relevant harness, mark it done,
  `append_log` what was decided, commit, exit.
- **Keep machine identifiers out of the tree.** Run records and analysis
  output are committed; hostnames and home-directory paths are not. If a
  tool writes one, scrub it before committing.
- **Do not re-run `ndx init` here** without restoring this file and
  `CLAUDE.md` afterwards: n-dx 0.8.0's init overwrites both with n-dx's own
  monorepo guidance (its packages, gateways and zone rules), which does not
  describe this project. Keep the `ndx-*` skills it refreshes; restore these
  two files from git and carry over only new tool names.
