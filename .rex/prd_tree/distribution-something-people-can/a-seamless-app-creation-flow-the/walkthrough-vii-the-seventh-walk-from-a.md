---
id: "76f13b53-f901-4a1a-8a05-59891b839cb8"
level: "task"
title: "Walkthrough VII · The seventh walk, from a fresh checkout, adds nothing"
status: "pending"
priority: "critical"
tags:
  - "walkthrough"
blockedBy:
  - "95371d9b-9fda-4f0c-940f-545b6342d327"
source: "The sixth walk, 2026-09-30: twenty-nine findings across all nine stages, so the log did not stay still."
acceptanceCriteria:
  - "a fresh checkout, pnpm install && pnpm build && pnpm test, then graview create of a new app beside it"
  - "all nine stages walked by an agent that did not do the first six walks"
  - "docs/walkthrough-findings.md gains nothing; if it does, the fixes land with criteria and the walk repeats"
description: "The sixth walk (task 95371d9b, a car dealership) worked all nine stages and added 29 findings, W-124 to W-152, so the log did not stay still. This is the next run: a fresh checkout, pnpm install && pnpm build && pnpm test, a new app beside it with graview create (use ../walk7, in a domain of its own, seeded at real size), all nine stages of docs/walkthrough.md by an agent that did not do the previous walks, and every finding fixed in a package with a criterion verified to fail without it. Notes from the sixth walk's review: a fix is not done until verify-site holds too (W-150's first fix passed its unit test and broke landmark-unique on the site); lines are not drawn while the scene moves, so a harness reads a line once its path has held, never on first appearance; a chapter's lines show for one frame, vanish for the arrival transition and come back — look at whether a line should wait for the arrival rather than flash. Run the browser harnesses one at a time; stop any dev server first."
lastModified: "2026-10-01T03:18:09.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
