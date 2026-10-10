---
id: "f089055d-b38a-4bdf-8dff-78eacd3cd500"
level: "feature"
title: "Who is here is on the bar, on both faces and a phone (FR-155)"
status: "completed"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-155"
  - "presence"
  - "bar"
source: "Graview Cloud, 2026-10-10 (the framework brief after 0.1.20, ../graview-cloud/docs/framework-brief-0.1.21.md)"
startedAt: "2026-10-10T20:00:00.000Z"
completedAt: "2026-10-10T20:00:00.000Z"
endedAt: "2026-10-10T20:00:00.000Z"
acceptanceCriteria:
  - "The AppBar draws who else is here: an initial per person on their hue, agents said as acting for someone, anonymous viewers counted"
  - "Pressing it lists names and where each one is"
  - "It is a polite status to assistive technology and never shown when alone"
  - "It costs the hosted page's first load nothing measurable, within Cloud's 570 KB shell budget"
description: "Presence was drawn as figures on the scene and nowhere on Pages or a phone, so a reader had no list of who is on the app. Cloud stands a stack under the bar (INTERIM(FR-155) hereStack in packages/client/src/shell.ts)."
lastModified: "2026-10-10T20:00:00.000Z"
resolution: "Fixed on bar/places-once-and-who-is-here: the AppBar draws the others from the provider's presence on every face and a phone, lists each by name and where each one is on a press, says it politely and draws nothing when alone; fetched with the bar's panes once somebody is, so the hosted page carries nothing more up front (593,425 bytes, 88 fewer). verify-who's whoIsHereIsOnTheBarOnTheScenePagesAndAPhone, pressedTheBarListsEachByNameAndWhereTheyAre and aloneTheBarDrawsNobodyNotEvenYourOtherTab hold it."
---
