---
id: "51803b2e-80c6-46cf-a56a-3e4d19c92357"
level: "task"
title: "0.1.39 · FR-189: A record drawn as a link answers the right-click menu, and a new tab keeps the app's base"
status: "pending"
priority: "critical"
tags:
  - "roadmap"
  - "graview-cloud"
  - "0.1.39"
source: "ndx-capture"
acceptanceCriteria:
  - "on a basePath page, right-clicking (or long-pressing) a board card offers Open, its acts and Move to ›, and Move to › moves it"
  - "every record a lens draws as a link (board cards via data-graview-listed, blocks lens cards and rows, grouped lists, calendar, table, home lists, galleries) is targeted as that record: data-graview-pick, data-graview-listed read, or a based href"
  - "\"Open in a new tab\" always carries the base (/a/<app>/features/<id>)"
  - "a harness on a basePath page: a board card's menu has Move to › and moves it on a phone; a blocks card's menu lists its acts; tests fail first"
description: "Roadmap f-block-cards-menu (FR-189, now, urgent): Cloud found it on 0.1.37 (blocks cards) and on 0.1.38 (board cards: with the Move button gone, a phone cannot move a card). aimAt recognizes a record only by data-graview-pick/data-graview-record or a link under base; these cards are a[href] without the base, so aimAtLink answers { about: [], href }. Cloud ships 0.1.38 with this as a known gap."
lastModified: "2026-10-19T20:00:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
