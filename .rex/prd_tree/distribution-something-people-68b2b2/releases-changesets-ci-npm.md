---
id: "1ce5c30c-ab11-45d3-bd32-79d4920093e2"
level: "feature"
title: "Releases: changesets, CI, npm"
status: "pending"
priority: "high"
acceptanceCriteria:
  - "Changesets installed and configured; a changeset is required for any package change"
  - "A GitHub workflow runs typecheck, tests and graview check on every push"
  - "A release workflow publishes to npm from a changeset-driven version PR"
  - "Every published package has a licence, a `files` allowlist and a working `exports` map"
  - "`npm pack` output is inspected in CI: no src, no tests, no tsbuildinfo"
  - "A smoke test installs the packed tarballs into a scratch project and builds a trivial app from them"
description: "From zero: no changesets, no workflows, every package private with no licence and no `files` field.\n\nThe decisions that need making rather than defaulting: which packages are public (all six? not `render` until the GPU path stops crashing on click?), what licence, and what the `\"./dist/*\"` subpath escape hatch means once strangers depend on it — inside one repo it is a pragmatic hatch, published it is a promise.\n\nConvention already set for this project: changeset bumps default to patch unless told otherwise."
---
