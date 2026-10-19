---
id: "71f1618d-676e-4e66-b49e-c4288973afdf"
level: "epic"
title: "What the roadmap asks for 0.1.38: boards without buttons, searchable lenses, places that tidy their views, a menu that offers what exists, the last of inline AI, and graview.dev's generated UI"
status: "completed"
completedAt: "2026-10-19T09:00:00.000Z"
priority: "high"
tags:
  - "roadmap"
  - "0.1.38"
source: "ndx-capture"
acceptanceCriteria:
  - "every task under this epic is completed or deferred with its reason written on its Roadmap item"
  - "a full local pnpm verify and the branch Nightly hold before the release PR merges"
  - "r-0-1-38 is published, and each Cloud half is a Roadmap feature with FRAMEWORK GIVES / CLOUD DOES / DONE WHEN"
description: "The framework items Nick raised or planned on 2026-10-19 (f-board-move-without-buttons, r-lens-search-filter, r-place-menu-hide-delete-views, r-menu-suggests-existing-views, feature:inline-ai-in-the-context-menu-directed-by-jev's framework half, f-dev-generated-ui), plus the 0.1.37 release's follow-ups (address in the Nightly, the recorded navigation flake, the scale harness). tsgo is measured (about 6.5x faster: tests' typecheck 16.1 s to 2.4 s, cold build 17.0 s to 2.7 s) but paused: 432 errors it reports that tsc does not, nearly all @types/node not loaded under tsgo, plus a few real inference differences."
lastModified: "2026-10-19T04:30:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Children

| Title | Status |
|-------|--------|
| [0.1.38 · A board moves without buttons, and the shipped lenses take search, filter and column options](./0-1-38-a-board-moves-without-buttons-and.md) | completed |
| [0.1.38 · Right-click a place to hide, delete and restore a view](./0-1-38-right-click-a-place-to-hide-or.md) | completed |
| [0.1.38 · The right-click menu offers an existing view or lens before drawing a new one](./0-1-38-the-menu-offers-an-existing-view.md) | completed |
| [0.1.38 · Inline AI, the framework's last part: a selection bar, one quiet hover chip, and the AI section under 400 ms](./0-1-38-inline-ai-the-frameworks-last.md) | completed |
| [0.1.38 · graview.dev shows the UI is generated, then reshaped by asking](./0-1-38-graview-dev-shows-the-ui-is.md) | completed |
| [0.1.38 · The Nightly runs address, and the flakes and the scale harness are settled](./0-1-38-the-nightly-runs-address-and.md) | completed |

## Notes

2026-10-19: every task completed on feat/0-1-38-additions. Boards move without buttons and the lenses take search, filter and column options; the menu offers the single best existing view (three in the quick ask, which has words) so the AI section is never taller; places hide, delete and restore views through `keptViews` (1.4 KB up front after review cut it from 5.1 KB: the gesture handler must refuse the browser's menu in the same event); inline AI's selection bar and opt-in hover chip, the AI section at 277 ms p95; graview.dev's hero ends on the departures board and a season section redraws one store three ways; address runs in the Nightly, the ground's travel is asked again, and the scale rise holds 60 fps after a real fix (a hub's lines measured the page a thousand times).
