---
id: "26313972-0b16-4a5f-8181-d918003a10db"
type: "capability"
title: "A thumbnail fitted to what stands: fit to content and a legible minimum building (FR-107)"
slug: "a-thumbnail-fitted-to-what-stands-fit"
statement: "The scene thumbnail can crop to the occupied extent of the map and keep each district legible at tile size, so the twelve Cloud templates draw at 264x132 with every district plainly visible."
criteria: [{"id":"c1","text":"When sceneThumbnail is called with fit \"content\", sceneThumbnail shall crop the thumbnail to the occupied extent of the map with a margin."},{"id":"c2","text":"When a minBuilding or density option is given, sceneThumbnail shall keep each district legible at tile size whatever its count."},{"id":"c3","text":"While sceneThumbnail keeps districts legible with minBuilding or density, sceneThumbnail shall keep the map's corners and hues as the Scene's."},{"id":"c4","text":"When any of Cloud's twelve templates is drawn with its seed counts at 264x132, sceneThumbnail shall show every district plainly visible and as legible as Cloud's own tiles."}]
tags:
  - "graview-cloud"
  - "FR-107"
source: "Graview Cloud, 2026-10-06 (brief after 0.1.12)"
priority: "low"
---

At 264x132 the faithful thumbnail keeps the map's full extent: each district is a speck on mostly empty ground; Cloud keeps its own tiles.
