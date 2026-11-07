---
id: "90c5e12a-6772-40ef-a824-e9e92e645767"
type: "change"
title: "0.1.37 · A rule's today() is the app's day, not UTC's"
slug: "0-1-37-a-rule-s-today-is-the-app-s-day"
intent: "Left open by the 0.1.37 time-zone task: isoToday(), which rules read as today(), is still the UTC date, so an app in New York turns its day at 8 PM. Rules that read the clock are re-judged when the day turns (f-rules-keep-time, 0.1.29): that turn must move with the zone."
acceptanceCriteria:
  - "with brand.timeZone declared, today() in rules, computed fields and templates is the date in that zone; without it, behavior is unchanged (documented which)"
  - "a server (graview serve, the room's alarm that re-judges rules when the day turns, f-rules-keep-time) and a page agree on the day for the same app; the day turns at the app's midnight"
  - "tests fail on the time-zone merge: e.g. at 2026-10-17T01:30Z an app in America/New_York reads today() as 2026-10-16"
touches:
  - "2a3989a1-e869-4459-8d39-a319da585093"
priority: "high"
tags:
  - "roadmap"
  - "0.1.37"
source: "ndx-capture"
resolution: "On feat/today-in-the-apps-zone: isoToday(timeZone?) is the date in the app's zone (given, else the page's app's), else UTC; a document reads its own brand.timeZone; Store takes timeZone and is judged and ticked on that day; openStore, openRemote, the embed and graview mcp pass the app's; untilTheDayTurns and tickEachDay keep to the app's midnight across DST."
---
