---
id: "243f1a62-8447-49bf-97a3-f936c374ce72"
level: "feature"
title: "A lazy part that fails to load tries again, and never breaks the page (FR-139)"
status: "completed"
priority: "critical"
tags:
  - "graview-cloud"
  - "FR-139"
  - "bug"
  - "resilience"
  - "a11y"
source: "Graview Cloud, 2026-10-08 (brief after 0.1.17)"
completedAt: "2026-10-08T20:37:59.000Z"
endedAt: "2026-10-08T20:37:59.000Z"
acceptanceCriteria:
  - "Every lazily imported part (the person's menu, Find, studio pieces and the rest) retries when the browser comes back online, and again the next time it is opened, with a new URL or cache-buster, since browsers keep a failed module"
  - "Until it arrives, the place it goes says so in one line with a Try again button; the embed doesn't throw"
  - "Optionally the menu's part is fetched when the page is idle and online"
  - "With the network off from page load, opening the person's menu shows the line, not an error; back online, the next open shows the whole menu without a reload; no pageerror in either case"
description: "A lazy chunk fetched while offline fails and the browser keeps the failure: the person's menu opens with only 'Keeping this app' and each open throws 'Failed to fetch dynamically imported module' until a reload. Cloud's realtime harness failed about half the time on 0.1.17."
lastModified: "2026-10-08T20:37:59.000Z"
resolution: "Shipped in #152 (0.1.18): every part a page fetches as it is first drawn goes through retryingImport (@graview/core/retry, a page's entry only) and lazyModule; a part that has not arrived says so in one line with a real Try again, throws nothing, and is asked for again online, on redraw, on reach and on Try again; the security review (#159) keeps the retry to the bundle's own chunks. pnpm verify offline holds it in three engines."
---
