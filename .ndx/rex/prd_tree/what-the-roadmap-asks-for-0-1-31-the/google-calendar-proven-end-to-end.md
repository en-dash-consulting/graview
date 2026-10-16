---
id: "70872e32-507e-47c1-ac6f-598cf520a1d3"
level: "task"
title: "Google Calendar, proven end to end against Google itself"
status: "in_progress"
startedAt: "2026-10-16T17:18:22.000Z"
priority: "medium"
tags:
  - "roadmap"
  - "graview-cloud"
  - "0.1.31"
source: "ndx-capture"
acceptanceCriteria:
  - "a sync against a real Google test calendar survives a token expiry, a rejected sync token (full resync) and an event round-tripped across timezones"
  - "the run is reproducible from a documented script that reads credentials from the environment and commits none"
description: "Roadmap f-google-calendar (building, priority now, target 0.2; Cloud's half is f-connections). The @graview/ship sync layer is covered against a scripted remote but has not run against Google: expiring tokens, rejected sync tokens, timezone round trips. Needs Google OAuth credentials for a test calendar from Nick; skip and note it on the Roadmap feature if none are handed over."
lastModified: "2026-10-16T04:36:23.667Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
