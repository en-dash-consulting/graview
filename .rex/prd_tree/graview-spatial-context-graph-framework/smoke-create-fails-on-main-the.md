---
id: "e5bb3848-7356-4a7b-801a-d2df23c0e6ff"
level: "task"
title: "smoke-create fails on main: the scaffolded project's strip never offers a first act"
status: "in_progress"
priority: "high"
startedAt: "2026-09-23T04:38:43.985Z"
acceptanceCriteria: []
description: "node scripts/smoke-create.mjs on main (2026-09-23, before and after the studio-door commit 491587b) passes through 'escapeDoesSomethingFromTheFirstScreen' and 'anEditSurvivesAReload', then fails theCheckerActuallySpoke, theStripDoesNotCoverWhatYouAreActingOn, nothingErroredInTheBrowser and everything after, ending in 'page.click: Timeout 30000ms exceeded waiting for #here [data-testid=\"affordances\"] button[data-affordance]'. Find which commit broke it (it is not in pnpm verify's chain, so nothing said so), fix it, and put smoke-create somewhere a failure is heard."
lastModified: "2026-09-23T04:38:44.046Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
