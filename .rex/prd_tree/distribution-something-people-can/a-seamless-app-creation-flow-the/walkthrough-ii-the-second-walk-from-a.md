---
id: "7ee40570-0c80-4592-8775-af48f89923de"
level: "task"
title: "Walkthrough II · The second walk, from a fresh checkout, adds nothing"
status: "failing"
priority: "critical"
tags:
  - "walkthrough"
startedAt: "2026-09-11T20:09:19.050Z"
failureReason: "The second walk added nineteen findings (W-032…W-050), so its own acceptance criterion — \"docs/walkthrough-findings.md gains nothing\" — is not met. All nine stages were walked and every finding is fixed in a framework package with a criterion verified to fail without the fix; the walk must now be repeated until the log stays still."
acceptanceCriteria:
  - "a fresh checkout, pnpm install && pnpm build && pnpm test, then graview create of a new app beside it"
  - "all nine stages walked by an agent that did not do the first walk"
  - "docs/walkthrough-findings.md gains nothing; if it does, the fixes land with criteria and the walk repeats"
description: "The playbook's own definition of done, and the one thing the first walk could not do for itself: a second agent, from a fresh checkout and the kick-off prompt at the top of docs/walkthrough.md, works all nine stages in a newly scaffolded app and adds nothing to docs/walkthrough-findings.md. Any finding it does add is fixed the same way as the first walk's — in a package, with a criterion — and the walk is run again until the log stays still."
lastModified: "2026-09-12T01:23:15.952Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
