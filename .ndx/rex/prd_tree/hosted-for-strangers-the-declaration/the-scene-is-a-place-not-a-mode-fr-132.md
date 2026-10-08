---
id: "2227d5d5-215b-43aa-bfc1-29faf402608a"
level: "feature"
title: "The scene is a place, not a mode (FR-132)"
status: "completed"
priority: "critical"
tags:
  - "graview-cloud"
  - "FR-132"
  - "design"
source: "Graview Cloud, 2026-10-07 (handoff: one app bar, and the scene as a place — from Nick using Farm Bureau POM Workshop)"
startedAt: "2026-10-08T00:01:41.000Z"
completedAt: "2026-10-08T00:01:41.000Z"
endedAt: "2026-10-08T00:01:41.000Z"
acceptanceCriteria:
  - "The scene becomes one of the app's places, a tab beside the others ('Overview' by default; the declaration can rename it); choosing it draws the scene in the page area under the same bar; leaving it returns to the place you were on"
  - "The Scene/Pages switch and 'Open the scene' are removed; the lens gallery and the relation map are each named once in words a reader would use, none of them 'scene' or 'pages'"
  - "faceAtAddress, where() and setApp keep working with the scene's address being its place's (/places/overview) and its stop riding on it; deep links to a scene stop still open it; a host that mounted with face: graview lands on the overview place"
  - "A reader moves between the overview and any list with one press on a tab, on phone and desk; no control says Scene or Pages"
description: "'Scene', 'Pages', 'Pictures' and 'Map' are four words for overlapping ideas; the scene is a separate mode while Map is a tab."
lastModified: "2026-10-08T01:00:00.000Z"
resolution: "Shipped in #137 (0.1.16): the scene is the Overview tab at /places/overview (pages: { overview } renames it), old #stop links open it and are replaced, and graview check refuses a place at the overview's address (pages-overview-taken)."
---
