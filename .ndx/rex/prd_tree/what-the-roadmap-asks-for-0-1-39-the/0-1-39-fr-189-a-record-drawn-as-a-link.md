---
id: "51803b2e-80c6-46cf-a56a-3e4d19c92357"
level: "task"
title: "0.1.39 · FR-189: A record drawn as a link answers the right-click menu, and a new tab keeps the app's base"
status: "completed"
priority: "critical"
tags:
  - "roadmap"
  - "graview-cloud"
  - "0.1.39"
source: "ndx-capture"
startedAt: "2026-10-19T21:00:00.000Z"
completedAt: "2026-10-19T23:30:00.000Z"
endedAt: "2026-10-19T23:30:00.000Z"
acceptanceCriteria:
  - "on a basePath page, right-clicking (or long-pressing) a board card offers Open, its acts and Move to ›, and Move to › moves it"
  - "every record a lens draws as a link (board cards via data-graview-listed, blocks lens cards and rows, grouped lists, calendar, table, home lists, galleries) is targeted as that record: data-graview-pick, data-graview-listed read, or a based href"
  - "\"Open in a new tab\" always carries the base (/a/<app>/features/<id>)"
  - "a harness on a basePath page: a board card's menu has Move to › and moves it on a phone; a blocks card's menu lists its acts; tests fail first"
description: "Roadmap f-block-cards-menu (FR-189, now, urgent): Cloud found it on 0.1.37 (blocks cards) and on 0.1.38 (board cards: with the Move button gone, a phone cannot move a card). aimAt recognizes a record only by data-graview-pick/data-graview-record or a link under base; these cards are a[href] without the base, so aimAtLink answers { about: [], href }. Cloud ships 0.1.38 with this as a known gap."
lastModified: "2026-10-19T23:30:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Notes

Decided:

- **The hrefs carry the base.** The routed face's `SpecLinks.href` (`packages/pages/src/router.tsx`, `RecordLinks`) joins the router's basename (`useHref("/")`) onto `recordPath`, since `ListedLink` draws an `<a href>`, not a `<Link>`. Every list a lens or a home draws through `SpecList`/`Listed`/the columns lens takes it. `ListRowFacts.href` stays basename-relative: every design hands it to `<Link to>`.
- **The menu reads `data-graview-listed`** (`packages/pages/src/context-menu.tsx`, `aimAt`): the record an item is listed as, wherever in it the press lands, its own stretched link (`.graview-spec-item-link`) included; a link the item draws to somewhere else, or a link around the whole list (a gallery's picture), stays that link. Lenses that draw marks (calendar, timeline, coverage, plan, board) already carried `data-graview-pick`.
- **On a status board a resting finger opens the card's menu** rather than choosing it: a card is `data-graview-choose` only while several are chosen. On a coarse pointer the board's menu section adds "Choose several" (`data-menu-item="choose-several"`) after Move to ›, which chooses the card and begins choosing. Lists keep the long press that chooses.
- Harness: `verify-address` gains `aBoardsCardLinksUnderTheBaseAndItsMenuMovesIt`, `aBlocksLensCardLinksUnderTheBaseAndItsMenuListsItsActs` and `openInANewTabKeepsTheBase`, at a desk (a right-click) and a phone (a touch resting), with a third base `/apps/a3` serving the tasks with a blocks lens of cards grouped by status.
