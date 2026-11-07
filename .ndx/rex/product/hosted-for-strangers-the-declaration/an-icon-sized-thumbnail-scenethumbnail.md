---
id: "65f9b2ed-baf0-46a7-a2f1-798ce7e98b13"
type: "capability"
title: "An icon-sized thumbnail: sceneThumbnail size icon at 32x32 (FR-130)"
slug: "an-icon-sized-thumbnail-scenethumbnail"
statement: "sceneThumbnail draws an icon-sized thumbnail at 32x32 from an app's own scene, which Cloud uses as the app's favicon."
criteria: [{"id":"c1","text":"When sceneThumbnail is called with size \"icon\", it shall draw at 32x32 the districts' plots in their hues with one block each, readable at 16 px."},{"id":"c2","text":"Cloud shall use the app's own scene as its favicon, so that two apps' tabs differ at a glance."}]
tags:
  - "graview-cloud"
  - "FR-130"
source: "Graview Cloud, 2026-10-07 (brief after 0.1.15)"
priority: "low"
resolution: "Shipped in #129 (0.1.16): sceneThumbnail(document, { size: \"icon\" }) draws the scene from altitude at 32 by 32; every other size is byte for byte what it was."
---

Cloud draws a cube in the app's accent as its favicon.
