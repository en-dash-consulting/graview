---
id: "f53296a7-a8f7-4ac1-bce8-62677155112b"
level: "task"
title: "Walkthrough IV · The fourth walk, from a fresh checkout, adds nothing"
status: "completed"
priority: "critical"
tags:
  - "walkthrough"
source: "The third walk, 2026-09-12: nineteen findings across all nine stages, so the log did not stay still."
startedAt: "2026-09-12T17:00:47.410Z"
completedAt: "2026-09-13T04:54:52.357Z"
endedAt: "2026-09-13T04:54:52.357Z"
resolutionType: "acknowledgment"
resolutionDetail: "The fourth walk was walked in full by a fresh agent and every finding (W-070…W-085) fixed with a criterion; W-086…W-089 followed from Nick's own use. The log did not stay still; the criterion is carried by the queued fifth walk (task 2fdf30c2), which runs after the demo features so it walks what they add. Closed so the queue follows the working order."
failureReason: "The fourth walk added sixteen findings (W-070…W-085), so its own acceptance criterion — \"docs/walkthrough-findings.md gains nothing\" — is not met. All nine stages were walked by a fresh agent in a newly scaffolded app at ../walk4 and every finding is fixed in a framework package with a criterion verified to fail without the fix (11 commits, e277977..2fb10c6). Stages G, H and I added nothing. The two things never walked before, brand.kit and @graview/studio, were exercised; three of the findings are the studio's write-back (an invented far-end argument, disarmed checkout rules and replaced bodies, a dropped far-end reading). The walk must be repeated until the log stays still."
acceptanceCriteria:
  - "a fresh checkout, pnpm install && pnpm build && pnpm test, then graview create of a new app beside it"
  - "all nine stages walked by an agent that did not do the first three walks"
  - "docs/walkthrough-findings.md gains nothing; if it does, the fixes land with criteria and the walk repeats"
description: "The third walk (task a4d28161) worked all nine stages and added nineteen findings, W-051 to W-069, so the feature's own condition for done — \"a second run from a fresh checkout adds nothing to the findings log\" — is still unmet. This is the next run: a fresh checkout, `pnpm install && pnpm build && pnpm test`, a new app scaffolded beside it with `graview create`, and all nine stages of docs/walkthrough.md worked in order. Any finding it adds is fixed the same way — in a package, with a criterion verified to fail without the fix — and the walk repeats until the log stays still. The third walk's subject app is at ../walk3 and can be deleted; a fresh one is the point.\n\nPractical notes from the third walk. Run the browser harnesses one at a time or in small foreground batches — several Playwright launches back to back get killed. Seed inside the same Playwright context you assert in, and put ?remember=1 on every goto or the store resets under webdriver; note that ?fresh=1 EMPTIES the remembered store, so an \"empty app\" state must be taken last or in a context of its own. `pnpm engines` is now in the playbook's end-of-stage list and is the only harness that opens WebKit or Firefox: two of the third walk's findings existed only there. Where the third walk was weakest and a fourth should press: the derived pages' other surfaces at 200% text (only four routes are covered by readersOwnTextSize), the agent seat's own turn under a policy, and anything the chat can be asked that the graph answers wrongly rather than not at all."
lastModified: "2026-09-13T04:54:52.371Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
