---
id: "73f880d8-8314-4beb-8711-72b5d98dc752"
level: "task"
title: "0.1.35 · Playback asks the host for a past declaration lazily"
status: "pending"
priority: "high"
tags:
  - "roadmap"
  - "graview-cloud"
  - "0.1.35"
source: "ndx-capture"
acceptanceCriteria:
  - "HistoryHost takes a lazy declarationAt(seq): Promise<PastDeclaration | undefined>, asked when playback reaches a mark handed without a declaration; the moment is drawn under that declaration"
  - "marks handed with declarations work unchanged; a page's first load carries no past declaration; a test fails on 0.1.34"
description: "Roadmap f-declaration-at-lazy. HistoryHost.declarations must carry every version's compiled declaration up front (27 on the Roadmap app) for the past to be drawn under the declaration then in force; Cloud sends only the sentences."
lastModified: "2026-10-18T16:00:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
