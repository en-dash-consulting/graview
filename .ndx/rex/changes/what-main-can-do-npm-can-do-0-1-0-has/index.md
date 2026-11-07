---
id: "0e2ca976-5491-4632-801c-dbac41641948"
type: "change"
title: "What main can do, npm can do: 0.1.0 has no sights, so publish what the walks built"
slug: "what-main-can-do-npm-can-do-0-1-0-has"
intent: "Building Cloud against the published @graview/core 0.1.0 found that Policy.sees, Sight, sees(), sightedKinds and seenBy — added by the seventh walk and on main — are not in the published package: Policy is {grants, roles} only. A consumer cannot use what the README and the walks describe. Cloud reimplemented sights host-side (packages/room/src/sights.ts). POSITION: cut 0.1.1 (or 0.2.0) from main with a changeset, and add a CI check that the exports named in each package README exist in the packed tarball."
acceptanceCriteria:
  - "npm view @graview/core shows a version whose Policy type has sees and whose index exports seenBy"
  - "scripts/inspect-pack.mjs fails when a README names an export the tarball lacks"
touches:
  - "1abc350c-e5bf-4eee-87c4-7c67287a10db"
priority: "high"
tags:
  - "graview-cloud"
  - "release"
source: "Graview Cloud build, 2026-10-02"
---
