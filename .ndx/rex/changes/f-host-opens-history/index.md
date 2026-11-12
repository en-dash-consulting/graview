---
id: "abae0586-add2-46d0-a2d4-c6de36c84e40"
type: "change"
title: "History opens from the app menu, and a host can open it"
slug: "f-host-opens-history"
intent: "Nick, from Formula 1 on Graview Public: it is hard to find an app's previous versions or changelog; record history lives under bell → Activity → \"As it was\". Cloud asked (brief b-cloud-2026-11-10-views-and-history) for a way for the host to open the timeline/Activity from its own menu. Nick decided 2026-11-10: for now, a plain History entry in the Notifications popover (the nav is reorganized later), opening the app's timeline and Activity; and the host opens the same thing through a mount-handle method (showHistory()) or an address."
acceptanceCriteria:
  - "The app menu has a History row, named plainly, that opens the app's timeline (harness claim; Nick moved it from the Notifications popover on 2026-11-10)"
  - "The mount handle has showHistory(), which opens the same history the entry does (unit test), and an address opens it too"
  - "Keyboard and screen reader reach the entry; the watch finds no new problem on the popover"
  - "The changeset carries a Compatibility line for the JavaScript API"
touches:
  - "f7d98d04-10db-4583-a1d0-7788ead43d4c"
priority: "medium"
tags:
  - "graview"
  - "history inbox"
  - "hq:feature:f-host-opens-history"
source: "Graview HQ feature:f-host-opens-history"
---
