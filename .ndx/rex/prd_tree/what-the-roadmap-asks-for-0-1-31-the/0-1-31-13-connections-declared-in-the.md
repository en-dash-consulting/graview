---
id: "fab2c947-bbcc-4b59-a74b-70182fd8f32b"
level: "task"
title: "0.1.31 · 13: Connections declared in the app and run by graview serve: a Google calendar, filtered, read-only or both ways"
status: "pending"
priority: "high"
tags:
  - "roadmap"
  - "graview-cloud"
  - "0.1.31"
blockedBy:
  - "70872e32-507e-47c1-ac6f-598cf520a1d3"
source: "conversation"
acceptanceCriteria:
  - "a connections entry in the declaration (system, calendar, kind and field mapping, filter by whole calendar, one color or a title tag, direction read-only or both ways, conflict policy) is judged by graview check, with a finding for each wrong shape"
  - "graview serve and graview preview run the sync on that entry with credentials from the environment, keep its cursor beside the app's data, and credit changes from the other side to the system in Activity"
  - "a test against the scripted remote covers each filter and both directions, and the meetings demo runs from the declaration alone"
description: "Roadmap f-connections-declared (Nick, 2026-10-16, after the local calendar demo: 'is there a configuration area? like to open read/write events in a calendar that have a certain label'). Today the sync is configured in code (scripts/calendar-sync-demo.mjs). Declare it instead, so a self-hoster configures a connector in the declaration and Cloud's Connections page (f-connections-page) writes the same entry. Google refuses a sync token combined with a search, so color and tag filters apply as events arrive; events Graview creates carry a private extended property. The studio shows the entry as a form."
lastModified: "2026-10-16T17:02:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
