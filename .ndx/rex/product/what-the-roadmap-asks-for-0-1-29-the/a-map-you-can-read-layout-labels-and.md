---
id: "0d1ecdd1-91d0-4dc9-b323-de7239ef7354"
type: "capability"
title: "A map you can read: layout, labels and links"
slug: "a-map-you-can-read-layout-labels-and"
statement: "The city map lays out districts by how kinds relate, keeps them inside the view, and labels them legibly."
criteria: [{"id":"c1","text":"The city layout shall place districts by how kinds relate, from upstream to downstream, and shall put kinds with no links in a margin."},{"id":"c2","text":"The city layout shall cap plot size so that the biggest kind does not take over the map."},{"id":"c3","text":"The map shall show under each district only its name, count and problem count, on a solid backing, at a fixed screen size."},{"id":"c4","text":"The map shall show lens names in the bar and on hover rather than under districts, and shall never place overflow counts on labels."},{"id":"c5","text":"When the map opens, the view shall contain all districts and keep them clear of the bar and the corner controls."},{"id":"c6","text":"The map shall either explain or omit the marks that were previously unexplained: the dots and diamonds after counts, 'moved ×', '1 of 17 tied' and 'Down to <lens>'."},{"id":"c7","text":"The map shall offer a gentler tilt or a top-down toggle."}]
requirements: [{"id":"0d1ecdd1-91d0-4dc9-b323-de7239ef7354:c4","title":"The map shall show lens names in the bar and on hover rather than under districts, and shall never place overflow counts on labels","description":"Linked to: .claude/worktrees/agent-a6df9d685b7bf06cc/packages/primitives/tests/unit/the-bar-names-the-district-you-are-in.test.ts","category":"technical","validationType":"automated","acceptanceCriteria":["The map shall show lens names in the bar and on hover rather than under districts, and shall never place overflow counts on labels."]}]
tags:
  - "roadmap"
  - "f-map-readable"
source: "Nick, 2026-10-13: \"do all planned items for graview core that the roadmap has laid out. capture and work them in ndx appropriately\""
priority: "high"
resolution: "Shipped on feat/a-map-you-can-read: the city map lays kinds out upstream to downstream (left to right, top to bottom in a tall window) with unlinked kinds in a margin, sides capped at three cells, the whole city fitted in the window clear of the corner chrome, a name, count and problem count under each district on a solid backing at a fixed size (lens names in the bar and on hover, colliding names said shorter or not until closer), the unexplained marks removed or said, and a From above toggle."
---

On LifeLogics Recon and the Roadmap the city's districts float unordered, plots grow with the biggest kind, labels pile onto blocks and neighbors, and districts are cropped at every edge. Roadmap f-map-readable.
