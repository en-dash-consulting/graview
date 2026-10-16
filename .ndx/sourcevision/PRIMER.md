<!-- sourcevision-primer fingerprint: fd3d96d10335f90a -->

# Graview — Primer for New Engineers

## 1. Layout

This is a monorepo with two top-level trees:

- `packages/` — the fourteen `@graview/*` published packages (core, layout, tools, render, react, primitives, pages, ship, studio, embed, guest, skills, graview, create-graview). This is production code.
- `apps/` — example apps and fixtures (todo, seedbed, rota, launcher, promo, site, discography, spike, gauntlet, etc.). These are not published; `changesets` ignores them.
- `scripts/` — browser harnesses (`verify-*.mjs`), packaging rehearsals (`smoke-*.mjs`), and docs-site build scripts.
- `docs/` — harness verdicts as JSON files, plus the generated docs site (`docs/site/`).

Tests live alongside the code they cover, split into `tests/unit/`, `tests/document/`, and `tests/integration/` under each package (e.g. `packages/core/tests/unit/`, `packages/ship/tests/integration/`). There's also a top-level `tests/` directory for cross-package acceptance checks. Within `packages/core/src/`, source is further organized into `document/`, `schema/`, `cli/`, `mutations/`, `scaffold/`, and `views/` subdirectories.

## 2. Build and test commands

pnpm install && pnpm build     # build the framework; apps typecheck against dist/
pnpm test                      # vitest, headless: no GPU, no browser
pnpm typecheck                 # packages, apps, and every package's tests
pnpm check                     # graview check against every app's declaration
pnpm verify                    # every browser harness (~10 min)
pnpm verify <name> [<name>]    # only named harnesses (pnpm verify --list)
pnpm verify --failed           # only what failed last time
pnpm verify --quick            # fewer widths/schemes/seats
pnpm dev                       # apps/todo → http://localhost:5193
pnpm apps                      # the desk → http://localhost:5199

## 3. Conventions

- TypeScript throughout (1673 files), with a little JavaScript, Python (discography's MusicBrainz scripts), and one shell script.
- Test framework is Vitest; test files are named as full sentences describing the claim they verify (e.g. `a-change-costs-what-it-touches.test.ts`), not by the unit under test.
- Every change under `packages/` requires a changeset (`pnpm changeset`), default bump `patch`; CI rejects a PR without one.
- Harnesses write verdicts to `docs/*.json` as named claims — after running one, read the JSON and report which named claim failed, not a log summary.
- Public API surface is deliberately restricted — each package exports only specific entry points listed in `package.json` `exports`; don't add new ones casually.
- Pre-1.0: no backwards-compatibility shims or deprecated aliases — shapes change outright.
- Products never install `zod` directly; `@graview/core` re-exports `z`.

## 4. What would waste a newcomer's first hour

- **Harnesses hold ports and run one at a time per checkout.** Running `pnpm verify` twice concurrently in the same checkout, or alongside `pnpm dev`, will collide. A second worktree needs `GRAVIEW_PORT_BASE` set to an unused hundred.
- **Don't edit package sources while a harness chain is running** — its dev servers serve those files live, so edits will be picked up mid-run and produce confusing failures.
- **Playwright is pinned at 1.49.1 on purpose** — WebKit hangs on `newPage` past that version on this macOS. Don't "helpfully" bump it.
- **A God function flagged in `scripts/verify-navigation.mjs`** (241 unique function calls in one module) is a known, pre-existing condition — not something introduced by your change.
- **51 circular dependency chains exist already** (e.g. in `core-document`/`core-ops`), along with bidirectional coupling between those two zones. These are tracked, long-standing issues, not regressions to chase down on a first PR.
- The repository has its own project-management layer (`.ndx/`) with PRD tracking (`ndx status`, `ndx work`) — this is separate from GitHub issues and worth knowing exists before assuming there's no task tracker.
