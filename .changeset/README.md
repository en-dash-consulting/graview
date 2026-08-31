# Changesets

Every change to a package under `packages/` needs one. `pnpm changeset` writes
it; CI refuses a pull request that changes a package without one.

**Bumps default to `patch`** unless there is a reason to say otherwise. That is
this project's convention rather than changesets' — a minor bump is a claim
about a new capability, and most changes are not.

The apps under `apps/` are ignored. They are EXAMPLES and fixtures — each was
built to prove a different claim about the framework, and they are what the
browser harnesses drive — not products anyone installs. A real product built on
Graview lives in its own repository and depends on these packages the way any
other consumer would; the smoke test in `scripts/smoke-install.mjs` is a
standing rehearsal of exactly that.
