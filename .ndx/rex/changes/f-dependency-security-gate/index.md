---
id: "ce80f103-a023-4ccb-a742-0e78beafbc4d"
type: "change"
title: "A pull request and a release are checked for vulnerable or unsigned dependencies, and a new version waits a week before the lockfile takes it"
slug: "f-dependency-security-gate"
intent: "Nick, 2026-11-18. Nothing in CI, Nightly or the publish job checks dependencies: installs are --frozen-lockfile and publishing carries provenance, but no audit or signature check runs, there is no Dependabot, and the repo's .npmrc sets minimum-release-age=0, which is how csstype 3.2.4 came in the day it was published. pnpm audit on 2026-11-18 found 77 advisories in the workspace, ten of them reaching @graview/tools through @modelcontextprotocol/sdk (hono, @hono/node-server, body-parser, qs, ip-address)."
acceptanceCriteria:
  - "A `dependencies` job runs on every pull request and in the release job before publish (workflow test)"
  - "It fails on a high or critical advisory that reaches a published package's dependency tree, and reports without failing one that reaches only examples or dev tooling (test of the script over a fixture audit)"
  - "It runs `npm audit signatures` over the lockfile's packages and fails on a missing or invalid signature (job)"
  - "It prints the lockfile versions changed against main in the job summary (test of the script)"
  - "The repo's .npmrc holds `minimum-release-age` at 7 days, and AGENTS.md says how an urgent fix is taken sooner (test)"
  - "The lockfile resolves hono >= 4.13.16, @hono/node-server >= 2.1.6, body-parser >= 2.4.0, qs >= 6.16.1, ip-address >= 10.7.4, and `pnpm audit --prod` finds nothing high or critical under packages/ (job)"
priority: "high"
tags:
  - "graview"
  - "ci"
  - "hq:feature:f-dependency-security-gate"
source: "Graview HQ feature:f-dependency-security-gate"
---
