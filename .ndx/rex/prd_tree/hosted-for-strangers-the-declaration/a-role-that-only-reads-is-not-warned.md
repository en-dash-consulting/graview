---
id: "2da41444-ab48-4789-a445-682221257285"
level: "feature"
title: "A role that only reads is not warned that it may do nothing"
status: "completed"
priority: "high"
tags:
  - "graview-cloud"
  - "checker"
  - "roles"
source: "Graview Cloud, 2026-10-10 (the framework brief after 0.1.20, ../graview-cloud/docs/framework-brief-0.1.21.md)"
startedAt: "2026-10-10T17:10:00.000Z"
completedAt: "2026-10-10T17:10:00.000Z"
endedAt: "2026-10-10T17:10:00.000Z"
acceptanceCriteria:
  - "role-may-do-nothing does not fire on a role with read grants or a role the declaration names as its reader"
  - "It still fires on a role that can neither read nor act"
description: "role-may-do-nothing fires on every Cloud template's viewer role and a fixture; a role that may only read is the point of a viewer, so the warning says nothing a builder should act on."
lastModified: "2026-10-10T17:10:00.000Z"
resolution: "Fixed in #192: role-may-do-nothing fires only for a role that can neither run a mutation nor see a kind (no sees, or a sight naming it, is reading)."
---
