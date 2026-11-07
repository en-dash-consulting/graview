---
id: "2227d5d5-215b-43aa-bfc1-29faf402608a"
type: "capability"
title: "The scene is a place, not a mode (FR-132)"
slug: "the-scene-is-a-place-not-a-mode-fr-132"
statement: "The scene is one of the app's places, shown as a tab beside the others and chosen with one press, rather than a separate mode."
criteria: [{"id":"c1","text":"The app shall offer the scene as a place, a tab beside the others, named 'Overview' by default and renamable by the declaration."},{"id":"c2","text":"When a reader chooses the scene tab, the app shall draw the scene in the page area under the same bar."},{"id":"c3","text":"When a reader leaves the scene tab, the app shall return them to the place they were on."},{"id":"c4","text":"The app shall show no Scene/Pages switch and no 'Open the scene' control."},{"id":"c5","text":"The app shall name the lens gallery and the relation map once each, in words a reader would use other than 'scene' or 'pages'."},{"id":"c6","text":"The app shall give the scene the address of its place (/places/overview), with its stop carried on that address, and faceAtAddress, where() and setApp shall keep working with it."},{"id":"c7","text":"When a reader opens a deep link to a scene stop, the app shall open that stop."},{"id":"c8","text":"When a host mounts the app with face: graview, the app shall land on the overview place."},{"id":"c9","text":"While a reader is on a phone or a desk, the app shall let them move between the overview and any list with one press on a tab."},{"id":"c10","text":"The app shall show no control labeled Scene or Pages."}]
tags:
  - "graview-cloud"
  - "FR-132"
  - "design"
source: "Graview Cloud, 2026-10-07 (handoff: one app bar, and the scene as a place — from Nick using Farm Bureau POM Workshop)"
priority: "critical"
resolution: "Shipped in #137 (0.1.16): the scene is the Overview tab at /places/overview (pages: { overview } renames it), old #stop links open it and are replaced, and graview check refuses a place at the overview's address (pages-overview-taken)."
---

'Scene', 'Pages', 'Pictures' and 'Map' are four words for overlapping ideas; the scene is a separate mode while Map is a tab.
