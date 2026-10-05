---
id: "a4d28161-6559-4135-8139-bcf0cf61041c"
level: "task"
title: "Walkthrough III · The third walk, from a fresh checkout, adds nothing"
status: "completed"
priority: "critical"
tags:
  - "walkthrough"
source: "The second walk, 2026-09-11: nineteen findings across the nine stages, so the log did not stay still."
startedAt: "2026-09-12T01:47:41.724Z"
completedAt: "2026-09-13T04:54:48.915Z"
endedAt: "2026-09-13T04:54:48.915Z"
resolutionType: "acknowledgment"
resolutionDetail: "The third walk was walked in full and every finding (W-051…W-069) fixed with a criterion. The log did not stay still; the criterion is carried by the queued fifth walk (task 2fdf30c2). Closed so the queue follows the working order."
failureReason: "The third walk added nineteen findings (W-051…W-069), so its own acceptance criterion — \"docs/walkthrough-findings.md gains nothing\" — is not met. All nine stages were walked in a freshly scaffolded app at ../walk3 and every finding is fixed in a framework package with a criterion verified to fail without the fix; the walk must be repeated until the log stays still. No stage added nothing this time, including the two (H, and the embed half of F) that were quiet in the second walk."
acceptanceCriteria:
  - "a fresh checkout, pnpm install && pnpm build && pnpm test, then graview create of a new app beside it"
  - "all nine stages walked by an agent that did not do the first or second walk"
  - "docs/walkthrough-findings.md gains nothing; if it does, the fixes land with criteria and the walk repeats"
description: "The second walk (task 7ee40570) worked all nine stages and added nineteen findings, W-032 to W-050, so the feature's own condition for done — \"a second run from a fresh checkout adds nothing to the findings log\" — is still unmet. This is the next run: a fresh checkout, `pnpm install && pnpm build && pnpm test`, a new app scaffolded beside it with `graview create`, and all nine stages of docs/walkthrough.md worked in order by an agent that did not do the previous walks. Any finding it adds is fixed the same way — in a package, with a criterion verified to fail without the fix — and the walk repeats until the log stays still. The second walk's subject app is at ../walk2 and can be deleted; a fresh one is the point. Practical notes in docs/walkthrough.md and in the log's second-walk summary: run the browser harnesses in foreground batches of four (all eleven at once was killed for memory), seed inside the same Playwright context you assert in, and put ?remember=1 on every goto or the store resets under webdriver."
lastModified: "2026-09-13T04:54:48.927Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
