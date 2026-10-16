---
id: "d182b1bc-d4a4-4183-a844-8716be4aeeda"
level: "task"
title: "0.1.31 · 12: Listen to the stops with real VoiceOver (and NVDA if a machine is available)"
status: "deferred"
priority: "low"
tags:
  - "roadmap"
  - "graview-cloud"
  - "0.1.31"
source: "ndx-capture"
acceptanceCriteria:
  - "docs/voiceover-walk.md agrees with the headless walk at every stop, or each difference is fixed or filed"
description: "Roadmap f-voiceover-by-ear, the second half of the screen-reader pass (PR #284, docs/screen-reader-walk.md). NEEDS NICK's Mac: skip unless he hands it over. On that Mac: npx @guidepup/setup once, npm install --prefix ~/.graview-voiceover @guidepup/guidepup@0.24, pnpm build, then GUIDEPUP=~/.graview-voiceover node scripts/voiceover-walk.mjs, which writes docs/voiceover-walk.md; compare it with the headless walk (labels in CSS capitals may be spelled out letter by letter)."
lastModified: "2026-10-16T20:24:14.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Notes

2026-10-16: deferred out of 0.1.31 at Nick's word ("lets skip the voiceover walk for this release"). Nothing in the framework blocks it; it waits for a time the Mac can be handed over. Roadmap f-voiceover-by-ear now targets "after 0.1.31" and says so.
