---
id: "941cf3e9-fdac-4a0c-8965-b9bcdcd7e7c6"
type: "capability"
title: "Selecting draws only the connections that explain it"
slug: "selecting-draws-only-the-connections"
statement: "When something is selected in the scene, the product draws only the connections that explain that selection, with one line style per meaning, instead of drawing every line at once."
criteria: [{"id":"c1","text":"While nothing is selected, the scene shall draw no record-level lines and shall draw one ribbon per relation between districts, with a width equal to the link count and a label shown on hover."},{"id":"c2","text":"When a record is selected, the scene shall draw only that record's own links, label each with the relation in the kind's words, and dim the rest of the scene."},{"id":"c3","text":"When a district is selected, the scene shall draw only the ribbons of that district's relations."},{"id":"c4","text":"The scene shall draw one line style per meaning and explain each style in the Key."},{"id":"c5","text":"When a record is selected, the product shall show the record's links as a list in a side panel in place of the 'tied' popover."}]
tags:
  - "roadmap"
  - "f-map-links-on-select"
source: "Nick, 2026-10-13: \"do all planned items for graview core that the roadmap has laid out. capture and work them in ndx appropriately\""
priority: "medium"
resolution: "From altitude each relation between two districts is one ribbon as wide as its links, routed in the gutters and said on hover (\"146 features → 14 areas, the part it lives in\"); a chosen district keeps only its ribbons, a chosen record draws only its own links labeled in its kind's words (solid to a record, dashed with a count into a district) and the rest recedes; the Key says the three manners; the floating 'tied' card is the record's links and the district's records in a panel beside the map (MapPanel)."
---

With something selected, the scene draws double tracks, dotted lines and curved red lines at once, none labeled. Roadmap f-map-links-on-select.
