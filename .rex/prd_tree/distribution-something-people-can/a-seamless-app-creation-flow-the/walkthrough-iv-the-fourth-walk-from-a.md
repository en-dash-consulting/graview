---
id: "f53296a7-a8f7-4ac1-bce8-62677155112b"
level: "task"
title: "Walkthrough IV · The fourth walk, from a fresh checkout, adds nothing"
status: "in_progress"
priority: "critical"
tags:
  - "walkthrough"
source: "The third walk, 2026-09-12: nineteen findings across all nine stages, so the log did not stay still."
startedAt: "2026-09-12T17:00:47.410Z"
acceptanceCriteria:
  - "a fresh checkout, pnpm install && pnpm build && pnpm test, then graview create of a new app beside it"
  - "all nine stages walked by an agent that did not do the first three walks"
  - "docs/walkthrough-findings.md gains nothing; if it does, the fixes land with criteria and the walk repeats"
description: "The third walk (task a4d28161) worked all nine stages and added nineteen findings, W-051 to W-069, so the feature's own condition for done — \"a second run from a fresh checkout adds nothing to the findings log\" — is still unmet. This is the next run: a fresh checkout, `pnpm install && pnpm build && pnpm test`, a new app scaffolded beside it with `graview create`, and all nine stages of docs/walkthrough.md worked in order. Any finding it adds is fixed the same way — in a package, with a criterion verified to fail without the fix — and the walk repeats until the log stays still. The third walk's subject app is at ../walk3 and can be deleted; a fresh one is the point.\n\nPractical notes from the third walk. Run the browser harnesses one at a time or in small foreground batches — several Playwright launches back to back get killed. Seed inside the same Playwright context you assert in, and put ?remember=1 on every goto or the store resets under webdriver; note that ?fresh=1 EMPTIES the remembered store, so an \"empty app\" state must be taken last or in a context of its own. `pnpm engines` is now in the playbook's end-of-stage list and is the only harness that opens WebKit or Firefox: two of the third walk's findings existed only there. Where the third walk was weakest and a fourth should press: the derived pages' other surfaces at 200% text (only four routes are covered by readersOwnTextSize), the agent seat's own turn under a policy, and anything the chat can be asked that the graph answers wrongly rather than not at all."
lastModified: "2026-09-12T17:00:47.422Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
