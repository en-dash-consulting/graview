# Graview

A framework for building applications where a typed context graph **is** the
interface rather than the backing store. A product declares its node kinds —
fields, edges, views, mutations, invariants, roles — once, in TypeScript, and
the framework derives the spatial scene, the routed pages, the legal actions,
the agent tool surface and the accessibility labels from that declaration.

`graview` is the tool a person installs. `@graview/*` is the framework a
product imports. All fourteen packages share one version.

## How work flows

The loop from an ask on Graview HQ to npm and Graview Cloud, its gates and
who acts at each, is [`docs/process.md`](docs/process.md). The rules every
agent follows on every change are [`.ndx/rex/workflow.md`](.ndx/rex/workflow.md),
whether it was started by `ndx work`, by the `dev-sync` pass, or from a brief
by hand. Read both before your first commit.

## Layout

```
packages/
  graview/         graview              the one CLI: create, check, types, doctor, docs, describe, lens, figure, serve, preview, shots, mcp, skills
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
  seedbed/         the garden: opens planted (Start empty or ?empty=1 for a blank graph), and the chapters on docs/site
  rota/            a volunteer rota: the served store, the calendar, three seats
  launcher/        the desk — a Graview app whose subject is the other apps
  promo/           the promotional site
  site/            graview.dev and its docs, as a Graview app: app.json, the design renderPlace writes every page with, the hand-designed pages
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
  `@graview/core/check`, the city and `sceneThumbnail` on `/scene` (the map alone, which the scene lays out with, on `/city`), the
  shipped drawings on `/figures`, a view's block resolver on `/blocks`,
  a status board's reach and `resolveFor` on `/describe`, arranging a list on `/arrange`, a kind's list as its page shows it (`shownList`) on `/shown`, a list written as a spreadsheet (`toCsv`, `listCsv`) on `/csv`, an app's head on a home screen (`homeScreenOf`, `themeColorsOf`) on `/head`, where a view's navigate goes as an address (`narrowedPath`) on `/navigate`, a link's provenance on `/provenance`, the app as it stood (`pastOf`, `pastAt`, `seqAt`) on `/past`, the timeline around it (ticks, what "Restore to here" takes back) on `/history`, another app's records read as the viewer (`linkedRecordsOver`, `recordLinkedChange`) on `/linked`, an act's form on `/forms`,
  the matcher on `/search`, a record and an argument said in words on `/words`, what the seat and
  the seeding read (`answerSeenBy`, `placesOf`, `beginning`) on `/seat`, the app's
  own actor's suggestions (`suggest`, `suggestions`, `acceptSuggestion`, `declineSuggestion`, `withdrawSuggestion`, `declined`, `tidyingOf`, Activity's digest) on `/tidying`,
  what the inline AI may pick from, the state a model reads and an AI
  interaction's entry (`catalogOf`, `aiContextOf`, `AiInteraction`) on `/catalog`,
  what a person asked to be told of, matched against a commit under their
  sight and said in words (`matchSubscriptions`, `watchSubscriptions`,
  `subscriptionWords`, `subscriptionProblem`) on `/subscriptions` — the
  shapes and the page's own store (`memorySubscriptions`) stay on the main entry,
  an app's jobs resolved and answered as a seat sees it (`jobsOf`, `jobsFor`,
  `answerJob`) on `/jobs` — the `purpose` shape stays on the main entry,
  what the app does on its own and when — the `workflows` shape, its step
  kinds (`STEP_KINDS`), `workflowsOf`, `nextRunAt`, `triggeredBy`, the
  checker's `workflow-*` — on `/workflows`, on no page,
  what people looked for and could not do — kept, counted across people, said
  to a model, and the one door a page records through (`frictionEvent`,
  `frictionOf`, `ownFriction`, `frictionDigest`, `recordFriction`) on `/friction`,
  one design proposed whole from the declaration (`composeDesign`,
  `inferJobs`, `accentFor`, and a seat's reading composed as edits, `composeReshape`, and a change to the app checked by the checker, `composeAppChange`) on `/compose`, on no page — a change to the app composed with the compile a page already has and the checks a change made on a page can fail, the whole checker left to the host that keeps it (`composeAppChange`, `compileForAChange`), on `/composer`, which an owner's or an editor's page fetches — the trait
  vocabulary and a document's reading alone (`TRAITS`, `TRAIT_WORDS`, `TRAIT_BRINGS`, `traitsOfDocument`) on `/traits`, which a page may fetch,
  the screens a device offers and the checker's words for one it cannot
  (`deviceScreensOf`, `screenPlaceOf`, `deviceFindings`) on `/devices`, on no page,
  what a change broke, said with the change (`compareViewRevision`,
  `picturedCoverage`, `problemsMade`, `beyondAsked`) on `/revisions`, on no page,
  binding a joining account to the person entered for it (`bindPerson`) on `/binding`, on no page,
  where a view drawn where the page cannot read shows its records (`judgeRecordBoxes`, `recordBoxesOf`, the one face's lines) on `/record-boxes`,
  and a kind's JSON Schema and an act's tool schema on `/json-schema`
  (`packages/core/tests/unit/the-main-entry-carries-only-what-a-page-draws-with.test.ts`).
  A page its host hands a compiled app imports `@graview/core/compiled`
  and nothing from `/document` up front, which would bring the compiler
  back (`pnpm verify hosted`).
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
pnpm verify:github <name> [<name>] [--quick] [--ref <branch>]  # the same harnesses on GitHub's runners (verify.yml): the branch pushed, the verdicts downloaded into docs/, each failing claim printed by name; no names for the whole chain

pnpm dev                       # apps/todo → http://localhost:5193
ANTHROPIC_API_KEY=… pnpm dev   # the same, its seat lent a model by the dev server — or XAI_API_KEY or OPENAI_API_KEY (aiDevProxy; GRAVIEW_AI_PROVIDER when several, GRAVIEW_AI_MODEL to choose; TYPESAFE_API_KEY makes Jev the Fast slot; never in a build, never in a harness)
pnpm apps                      # the desk → http://localhost:5199 (opens the others in place)
pnpm graview -- <args>         # the CLI from this checkout
pnpm graview:link              # `graview` on PATH from this checkout (pnpm link --global for packages/graview; `pnpm setup` once if pnpm has no global bin)

pnpm pack:inspect              # what goes in each tarball (docs/pack.json)
pnpm smoke                     # install the tarballs into a scratch app and build it
pnpm smoke:create              # graview create → install → its own verify → a real browser
pnpm site:build:all            # regenerate docs/site (css, numbers, docs pages)
pnpm skills                    # install the authoring skills into .claude/skills and .agents/skills
```

**A build agent runs the full harnesses on GitHub, not on the laptop**:
unit tests and `pnpm verify <name> --quick` locally while iterating, and
`pnpm verify:github <names>` for a harness's whole verdict (`--slow 4` for
the nightly's throttle, `--renderer gpu` for the GPU leg). Three local
chains beside each other's agents loaded the machine past ten, a wait
that holds on a quiet machine timed out as a failure, and one full
harness took four and a half hours. The run checks out the branch as
pushed, and runs that branch's own `verify.yml`: a branch cut before it has
none, so rebase onto main first.

The harnesses drive dev servers on fixed ports, so run **one harness chain
at a time** per checkout; a second checkout (a worktree) runs its servers
outside 5190–5289 by setting `GRAVIEW_PORT_BASE` (5600 puts todo on 5603:
every port moves to base + (port − 5190), through `scripts/lib/ports.mjs`,
and no harness writes a port of its own; the apps' vite configs move
with it, and the desk links to and probes the moved ports), and a harness only borrows a
server whose process runs in its own checkout's app directory (`scripts/lib/serve.mjs`); when another directory's server holds one of its ports, `pnpm verify` moves the whole run onto a free hundred and says so, stopping nothing. Each writes its verdict to `docs/*.json` as named claims; when one
fails it names the claim that stopped being true. Every page every harness
opens is also judged by the watch (`scripts/lib/watch.mjs`) — the keyboard
never left on `<body>`, no declared id shown to a person, no act offered
then refused, no page error — and the ledger (`docs/watch/ledger.json`)
keeps each problem once across harnesses and runs: a run ends by saying
what is new, still open, fixed, and back after a fix. `tests/site.test.ts`
checks that `docs/site` matches the tree — after changing package
descriptions or skills, run `pnpm site:build:all`. The test count on the
landing page is not a pull request's to write: the release step
(`pnpm release:prepare`, or the Version packages step) and the Pages deploy fill it in (`site-numbers.mjs --release`), so a PR never
touches `docs/site/index.html` or the sitemap just because it added tests.
A bundle budget raise is a file of its own in `scripts/budget-raises/`
(see `scripts/lib/bundle-budget.mjs`), never an edit to an entry's numbers,
and from 0.2.5 the batch writes it, never a build's PR: on a pull request into main whose head is
not `batch/*`, CI sets `GRAVIEW_BUDGET=warn`, so a byte ceiling it is over
is a warning in the job's summary and an annotation, not a failure. The
`batch/*` branch writes one raise for what its branches add together, and
fails while it is over, as main, Nightly and the release do. What a budget
guards against a mistake (a package a bundle must not carry, one left in a
lazy chunk that must load at once, the studio or a compiler up front, zod's
share, a chunk count) fails everywhere (`scripts/lib/budget-mode.mjs`).

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
  entries listed there (core's `./document`, `./compiled`, `./retry`, `./check`, `./scene`, `./city`, `./provenance`, `./history`, `./past`, `./linked`, `./tidying`, `./catalog`, `./jobs`, `./devices`, `./workflows`, `./compose`, `./composer`, `./traits`, `./subscriptions`, `./friction`, `./learn`, `./told`, `./revisions`, `./head`, `./record-boxes`,
  `./figures`, `./blocks`, `./describe`, `./arrange`, `./shown`, `./csv`, `./navigate`, `./forms`, `./json-schema`, `./search`, `./words`, `./markdown`, `./field-sight`, `./publishing`, `./binding`, `./typing`, `./seat`, `./typed`, `./sync`, `./import`, `./snapshot`, `./conformance`, `./scaffold`,
  `./lines`, `./testing` and the `./document.schema.json` the build writes; layout's `./view`, `./sizes` and `./view-moves`; guest's `./host/frame`; react's `./provider` and `./drawing`;
  tools' `./frame`, `./edit`, `./suggest`, `./derive`, `./go`, `./draft`, `./keep`, `./turn`, `./several`, `./inline-ai`, `./reshape` (a seat's words read as a change to the app) and `./tidy` (the app's own actor's judges and `dream`, on no page); embed's `./pages`, `./form` (a visitor's form alone) and `./first-draw` (what a face's first draw opens, for a host's build); pages' `./static` (a place as static HTML, no React), `./device` (a place on a fixed e-ink screen with what each region does, no React) and `./visitor-form`;
  `./cli`, `./browser`, `./dev`, `./gpu`, `./sqlite` and the rest). `files` is an allowlist and
  `scripts/inspect-pack.mjs` asserts against the real tarball.
- **Node 22.** Top-level await in the scaffolded app, and the engines field
  on every package.

## Dependencies

A version waits a week before the lockfile takes it: `.npmrc` sets
`minimum-release-age=10080` (pnpm counts minutes), so `pnpm install` and
`pnpm update` resolve nothing published in the last seven days. Every pull
request and the release job run `node scripts/dependency-check.mjs`, which
fails on a high or critical advisory reaching a published package's own
dependencies (examples, scripts, dev tooling and a package's devDependencies
are reported, not failed) and lists the lockfile versions that changed, and
`node scripts/dependency-check.mjs signatures`, which runs
`npm audit signatures` over every package the lockfile installs.

**An urgent fix taken sooner** is one package, in its own pull request: add
`minimum-release-age-exclude[]=<name>` to `.npmrc`, update that package
alone, and name the package, the version and the advisory it fixes in the
pull request's body. Take the line out again in the next change that touches
the lockfile once the version is a week old.

## Releasing

**A batch carries its own release.** Once a `batch/0-2-N` branch has its last
build merged in, `pnpm build && pnpm release:prepare`
(`scripts/release-prepare.mjs`) spends the changesets (`changeset version`:
the fixed group's next version, every changelog's section,
`FRAMEWORK_VERSION`), keeps or scaffolds that version's record in
`apps/site/releases.json`, and runs `site-numbers.mjs --release` and
`pnpm site:build:all`. A scaffolded record says `WRITE ME` until a person
rewrites it — headline, plain-words summary, and a compatibility line that
leads with what breaks for a host — and a test fails until it does; then
`pnpm site:build:all` again. It refuses a branch that already carries a
version main lacks: revert that commit and run it once. The batch PR's CI and
its Nightly, dispatched on its head after the last push, are the release's
gates (`scripts/require-changeset.mjs` reads the spent changesets from the
branch's history, and fails a release PR that leaves one unspent).

**Main publishes what it has.** `.github/workflows/release.yml` asks
`scripts/release-state.mjs` on every push to main (the rules are
`scripts/lib/release.mjs`'s, held by
`tests/a-release-runs-only-when-its-gates-hold.test.ts`). With nothing
pending and a version npm lacks, the `publish` job runs, but only when a
green Nightly ran on the same tree (`git rev-parse HEAD^{tree}` against the
tree of the commit that Nightly ran on), so a merge of a green batch that
conflicts with nothing counts. Without one, the run fails and says to
dispatch Nightly on main (`gh workflow run nightly.yml --ref main`) and
re-run it. The `publish` job **waits in the `npm` environment for its
required reviewer to approve it once in GitHub** — that one approval releases
all fourteen packages; Nick approves it, and nothing else needs him. It then
asks the gate again (`release-state.mjs --gate`), builds, tests, publishes
each package by npm trusted publishing (`scripts/release-publish.mjs`), tags
`<name>@<version>` and writes a GitHub release each. Re-running the job
finishes a release that stopped part way; neither path publishes a version
older than npm's `latest`. No Version packages pull request is
opened for a batch, and one still open once nothing is pending is closed.

**A changeset merged outside a batch is never stranded.** While a changeset
is pending on main, release.yml opens or updates the "Version packages" pull
request (and dispatches CI on it, since a pull request the workflow's own
token opens starts none). Write its release record there, run
`pnpm site:build:all`, dispatch Nightly on `changeset-release/main` (or on
main after the merge), and merge it; it is then published like a batch.

Each package's trusted publisher on npmjs.com names repository
`en-dash-consulting/graview`, workflow `release.yml`, environment `npm`, and
allows publish; `pnpm release:trust --apply` (npm 12, logged in as an owner)
sets that. A brand-new package can't have a trusted publisher until it
exists, so its first version is published by hand.

Nothing publishes while a changeset is pending, so a version merged and
followed by more changesets is released with the next one: 0.1.13 was
versioned and never published, and ships inside 0.1.14. Each GitHub
release's notes carry the changelog sections of the versions before it that
npm never had. A `Compatibility:` line on every changeset that touches a
surface (`scripts/lib/surfaces.mjs`) is what `docs/stability.md` promises a
host, and `capabilities().shipped` names the FR ids the changesets announce.

`main` is protected by a ruleset: changes arrive by pull request, `verify`
and `changeset` must pass, and nothing force-pushes or deletes it.
License: Elastic License 2.0, at the root and in every tarball.

## Key files

| Path | Purpose |
|------|---------|
| `packages/graview/src/index.ts` | The CLI dispatcher — the only place subcommands are wired |
| `packages/core/src/cli/` | `check`, `create`, `types`, `doctor`, `docs`, `describe`, `lens`, `figure` |
| `packages/core/src/scaffold/` | What `graview create` writes; `project.ts` holds the manifest and the package lists |
| `packages/skills/skills/*/SKILL.md` | The authoring skills a product installs |
| `scripts/verify-all.mjs` | The harness chain, cheapest first |
| `scripts/lib/tarballs.mjs` | Pack and pin the workspace as a stranger would receive it |
| `docs/site/` | The docs site, rendered from the records of `apps/site/app.json` by `scripts/site-docs.mjs` (never edited by hand); `docs/site/chapters.js` is built from `apps/seedbed` |
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
| `.ndx/rex/product/` | The PRD's product layer (v2): areas, capabilities and constraints, what the product does |
| `.ndx/rex/changes/` | The PRD's change layer (v2): one directory per change, an `index.md` and a `state.yaml`, placed on the product layer. `release-0-1-NN` records what a release shipped |
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
`get_capabilities`, `get_product`; write: `place_change`, `claim_task`, `release_task`, `update_task_status`,
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
