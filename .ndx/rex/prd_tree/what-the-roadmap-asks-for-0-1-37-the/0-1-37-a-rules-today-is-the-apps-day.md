---
id: "90c5e12a-6772-40ef-a824-e9e92e645767"
level: "task"
title: "0.1.37 · A rule's today() is the app's day, not UTC's"
status: "pending"
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
lastModified: "2026-10-18T23:00:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
