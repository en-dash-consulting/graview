---
id: "70849805-4b65-4122-850f-1c92fe751dd1"
level: "epic"
title: "What the roadmap asks for 0.1.31: the framework batch on the Graview Roadmap"
status: "completed"
completedAt: "2026-10-17T13:45:00.000Z"
priority: "high"
tags:
  - "roadmap"
  - "graview-cloud"
  - "0.1.31"
source: "ndx-capture"
acceptanceCriteria:
  - "every task under this epic is completed or deferred with its reason written on its Roadmap feature"
  - "r-0-1-31 is published listing only what shipped, and the release brief names the Cloud items it unblocks"
description: "Cloud's brief b-cloud-2026-10-16-batch-0-1-31 lists the framework batch for draft release r-0-1-31, worked in the order each feature's target gives ('0.1.31 · NN'): 01 the Pages Ask box setting, 02 the twelve W-224 collisions, 03 first load and page switches, 04 GPU compositing by default, 05 per-plane blur, 06 AI entries in Activity, 07 notify-me subscriptions, 08 the AI candidate catalog, 09 quick-ask replacing the Ask box, 10 graview.dev without the chat box, 11 Walkthrough XI (already in this PRD under Distribution), 12 VoiceOver by ear (needs Nick's Mac). Google Calendar end to end (f-google-calendar, building, priority now) rides along. Per the brief: Start building and Mark shipped each Roadmap feature as it lands; take a blocked one out of r-0-1-31; when the run stops, write true notes, publish, and send the release brief naming the Cloud items it unblocks (f-retire-ask-box by 09, f-act-notifications-config by 07, f-ai-interaction-history by 06)."
lastModified: "2026-10-17T13:45:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Children

| Title | Status |
|-------|--------|
| [0.1.31 · 01–02: Pages honors the Ask box setting, and the twelve covered controls are fixed](./0-1-31-0102-pages-honors-the-ask-box.md) | completed |
| [0.1.31 · 03: Faster first load and page switches, measured and held by a CI budget](./0-1-31-03-faster-first-load-and-page.md) | completed |
| [0.1.31 · 04–05: GPU compositing by default, with per-plane blur riding on it](./0-1-31-0405-gpu-compositing-by-default.md) | completed |
| [0.1.31 · 06+08: The AI candidate catalog, context assembler, Fast/Thinking provider slots and ghost layer, with AI interactions in Activity](./0-1-31-06-08-the-ai-candidate-catalog.md) | completed |
| [0.1.31 · 07: Notify me when X happens: subscriptions declared, matched under sight, offered in place](./0-1-31-07-notify-me-when-x-happens.md) | completed |
| [0.1.31 · 09–10: Quick-ask and in-place answer cards replace the Ask box, and graview.dev drops the chat box](./0-1-31-0910-quick-ask-and-in-place.md) | completed |
| [Google Calendar, proven end to end against Google itself](./google-calendar-proven-end-to-end.md) | completed |
| [0.1.31 · 12: Listen to the stops with real VoiceOver (and NVDA if a machine is available)](./0-1-31-12-listen-to-the-stops-with.md) | deferred |
| [0.1.31 · 13: Connections declared in the app and run by graview serve: a Google calendar, filtered, read-only or both ways](./0-1-31-13-connections-declared-in-the.md) | completed |
| [0.1.31 · 14: Dates and times are easy to enter and change: a real date and date-time editor built in](./0-1-31-14-dates-and-times-are-easy.md) | completed |

## Notes

2026-10-17: done. Every task is completed except 12 (VoiceOver by ear), deferred at Nick's word with the reason on f-voiceover-by-ear; 11 (Walkthrough XI) was left out of this run at Nick's word and f-walk-xi says so. The batch merged as #303; 0.1.31 was versioned and never published on its own, because the Nightly that gates a release went red on its new GPU half, so it shipped inside 0.1.32 (npm 2026-10-17) with the fixes #305, #307, #308, #309 and #310. r-0-1-31 is published as 0.1.32 with true notes, and brief b-framework-0-1-32 names the Cloud items it unblocks (f-retire-ask-box, f-act-notifications-config, f-ai-interaction-history, f-connections-page) and takes Cloud's FR-181 and FR-182, which shipped in 0.1.33 (#311).
