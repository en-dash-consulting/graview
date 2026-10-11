---
id: "da9b5d63-6fa2-4227-a67e-d717b04c27f3"
level: "feature"
title: "A record page's blocks get a page's budget by default"
status: "completed"
source: "n-dx-graview"
startedAt: "2026-10-11T01:30:00.000Z"
completedAt: "2026-10-11T03:40:00.000Z"
endedAt: "2026-10-11T03:40:00.000Z"
acceptanceCriteria: []
description: "resolveBlocks judges a record page's blocks under a card's allowance (500 steps) unless the caller raises budget, so a change with 98 tasks resolved every list on its page to '—'. A page is drawn once, not many times a frame: the default budget for a page slot should be the page's, with the card's kept for cards and rows. Surfaced by n-dx-graview (src/ui/declared.tsx)."
lastModified: "2026-10-11T03:40:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
resolution: "Done in #202, with resolveFor: a page, the home and a blocks lens are judged under PAGE_BUDGET (20 000 steps) by default and cards and rows keep 500; a change of 98 tasks lists them all on both faces (verify-declared, aRecordPageListsEveryRecordUnderAPagesBudget)."
---
