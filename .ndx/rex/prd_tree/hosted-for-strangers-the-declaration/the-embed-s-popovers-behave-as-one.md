---
id: "a3355e72-6676-47b5-a1ad-f6e2a7a73bd6"
level: "feature"
title: "The embed's popovers behave as one family: one open, Escape and outside click, focus in and back, kept in the viewport (FR-77)"
status: "completed"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-77"
  - "bug"
  - "a11y"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.8; staging live at staging.graview.cloud)"
startedAt: "2026-10-05T04:56:18.000Z"
completedAt: "2026-10-05T04:56:18.000Z"
endedAt: "2026-10-05T04:56:18.000Z"
acceptanceCriteria:
  - "Opening one popover closes any other"
  - "Escape and an outside click close it and focus returns to the control that opened it"
  - "Focus moves into it on open"
  - "It is anchored to its trigger and flips or scrolls within the viewport so no row is ever cut off"
  - "One test per behaviour, run against every popover in the embed"
description: "Two can be open at once, they don't all close on Escape or an outside click, focus doesn't move in and back, and the profile panel runs past the window's bottom edge."
lastModified: "2026-10-05T04:56:18.000Z"
---
