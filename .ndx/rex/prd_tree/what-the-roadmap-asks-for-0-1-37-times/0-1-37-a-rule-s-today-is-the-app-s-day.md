---
id: "90c5e12a-6772-40ef-a824-e9e92e645767"
level: "task"
title: "0.1.37 · A rule's today() is the app's day, not UTC's"
status: "completed"
priority: "high"
tags:
  - "roadmap"
  - "0.1.37"
source: "ndx-capture"
acceptanceCriteria:
  - "with brand.timeZone declared, today() in rules, computed fields and templates is the date in that zone; without it, behavior is unchanged (documented which)"
  - "a server (graview serve, the room's alarm that re-judges rules when the day turns, f-rules-keep-time) and a page agree on the day for the same app; the day turns at the app's midnight"
  - "tests fail on the time-zone merge: e.g. at 2026-10-17T01:30Z an app in America/New_York reads today() as 2026-10-16"
description: "Left open by the 0.1.37 time-zone task: isoToday(), which rules read as today(), is still the UTC date, so an app in New York turns its day at 8 PM. Rules that read the clock are re-judged when the day turns (f-rules-keep-time, 0.1.29): that turn must move with the zone."
completedAt: "2026-10-19T01:00:00.000Z"
endedAt: "2026-10-19T01:00:00.000Z"
lastModified: "2026-10-19T01:00:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
resolution: "On feat/today-in-the-apps-zone: isoToday(timeZone?) is the date in the app's zone (given, else the page's app's), else UTC; a document reads its own brand.timeZone; Store takes timeZone and is judged and ticked on that day; openStore, openRemote, the embed and graview mcp pass the app's; untilTheDayTurns and tickEachDay keep to the app's midnight across DST."
---

## Notes

**Decision: the app's zone, else UTC — never the runtime's or the reader's.** The day must
be the same on a server and a page for the same app, which neither the runtime's zone nor a
person's zone can promise, so today() is the date in `brand.timeZone` when declared and the
UTC date when not (unchanged). A reader's `timeZone` from a host changes how instants are
said, never which day it is.

**Where the zone rides.** `isoToday(timeZone?, at?)` (now exported, with `dayZoneFor`) reads
the given zone, else the app zone the page draws (`sayIn`'s `appTimeZone`), else UTC. A
compiled document's `build` defaults its today() to its own `brand.timeZone`, so its rules,
computed fields, guards, labels and act refs read the app's day on any host with nothing
passed. A TS app's store learns the zone from `StoreOptions.timeZone` (`Store.timeZone`):
`today()` then returns the date there, `tick(now)` takes `now`'s day there, and a call
without a context of its own hands that day to a function rule's context as `today`.
`openStore` (so `graview serve`), `openRemote`, the embed's `storeOf` and the tools CLI
pass `app.brand.timeZone`; `pastOf` carries it. `describePlace` and the block context fall
back to the app's zone too. Without a zone, `openStore` still installs its host-local-date
getter (W-186), unchanged.

**The turn.** `untilTheDayTurns(now, zone)` is the next midnight there, found as
`instantIn(tomorrow, 0)` and then nudged by quarter hours to the first moment whose date is
tomorrow, so a 23-hour spring day, a 25-hour fall day and a zone whose midnight is skipped
(Santiago) all land right. `tickEachDay` reads `store.timeZone`. A tick now judges what
stood on the day the store was last ticked to (a zoned store begins ticked to its opening
day), so the turn at the app's midnight reports what appeared and cleared and every
subscriber hears it; before, a store ticked just after midnight had already moved to the
new day before it judged "before".

**What a host on its own alarm must do (Cloud's room).** Pass `timeZone:
document.brand?.timeZone` to the `Store` it opens and set the alarm
`untilTheDayTurns(Date.now(), store.timeZone)` ahead, then `store.tick(new Date())`. A
store without the zone still reads the document's day in its rules (compiled default), but
`tick(now)` would take the UTC date and the alarm would fire at UTC midnight.

**Tests.** `packages/core/tests/unit/a-rules-today-is-the-apps-day.test.ts` (11 failed on
61382fb9, all 12 pass) and a zoned `openStore` case in
`packages/ship/tests/unit/a-store-is-judged-on-its-hosts-day.test.ts`. Harnesses `rota`
and `calendar` (`--quick`) hold. Budgets: hosted page +725 B, compiled +714 B, pages face
+457 B, embed +449 B, scene before drawn 936 KB.

**Left as it was.** An unzoned `openStore` pins today through its context getter, so its
`tick` reports nothing moved and its subscribers do not hear the turn (they read the new day
on their next judgment). Not changed here: the acceptance asked unzoned behavior to stay.
