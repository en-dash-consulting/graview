---
id: "1b5ca7a1-e785-44c9-ba5b-191e85294744"
level: "feature"
title: "The overview's address means the overview without its fragment (FR-154)"
status: "completed"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-154"
  - "address"
  - "scene"
source: "Graview Cloud, 2026-10-10 (the framework brief after 0.1.20, ../graview-cloud/docs/framework-brief-0.1.21.md)"
acceptanceCriteria:
  - "/places/overview with no fragment opens at altitude on the Shell, embed and the hosted page"
  - "A fragment that already says where it stands is respected"
  - "The address the framework writes for the overview needs no fragment to mean it"
  - "Cloud's restoreOverview can be deleted"
description: "The framework writes the overview as /places/overview#overview=1 and reads altitude from the fragment alone. A fragment never reaches a server, so the same address back through a sign-in door, a stored link or a bookmark opened the overview place descended on nothing: an empty scene whose control says Up. Cloud carries INTERIM(FR-154) restoreOverview in packages/client/src/shell.ts."
startedAt: "2026-10-10T18:00:00.000Z"
completedAt: "2026-10-10T18:00:00.000Z"
endedAt: "2026-10-10T18:00:00.000Z"
lastModified: "2026-10-10T18:00:00.000Z"
resolution: "Fixed in #191: a bare /places/overview opens at altitude, the framework writes the overview without a fragment, and an old #overview=1 link is tidied in place."
---
