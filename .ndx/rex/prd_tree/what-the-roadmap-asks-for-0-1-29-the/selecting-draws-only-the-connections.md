---
id: "941cf3e9-fdac-4a0c-8965-b9bcdcd7e7c6"
level: "feature"
title: "Selecting draws only the connections that explain it"
status: "completed"
priority: "medium"
tags:
  - "roadmap"
  - "f-map-links-on-select"
source: "Nick, 2026-10-13: \"do all planned items for graview core that the roadmap has laid out. capture and work them in ndx appropriately\""
startedAt: "2026-10-12T22:40:00.000Z"
completedAt: "2026-10-13T01:30:00.000Z"
endedAt: "2026-10-13T01:30:00.000Z"
acceptanceCriteria:
  - "At rest no record-level lines: one ribbon per relation between districts, width the link count, labeled on hover"
  - "A selected record draws only its own links, each labeled with the relation in the kind's words; the rest dims"
  - "A selected district draws only its relations' ribbons"
  - "One line style per meaning, explained in the Key"
  - "The 'tied' popover becomes the selected record's links list in a side panel"
description: "With something selected, the scene draws double tracks, dotted lines and curved red lines at once, none labeled. Roadmap f-map-links-on-select."
lastModified: "2026-10-13T01:30:00.000Z"
resolution: "From altitude each relation between two districts is one ribbon as wide as its links, routed in the gutters and said on hover (\"146 features → 14 areas, the part it lives in\"); a chosen district keeps only its ribbons, a chosen record draws only its own links labeled in its kind's words (solid to a record, dashed with a count into a district) and the rest recedes; the Key says the three manners; the floating 'tied' card is the record's links and the district's records in a panel beside the map (MapPanel)."
---
