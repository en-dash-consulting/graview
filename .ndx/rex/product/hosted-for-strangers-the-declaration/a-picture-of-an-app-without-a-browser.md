---
id: "c5efc332-411b-48a5-9de7-73229a9c0f7d"
type: "capability"
title: "A picture of an app without a browser: sceneThumbnail(document, { scheme }) as an SVG string (FR-74)"
slug: "a-picture-of-an-app-without-a-browser"
statement: "A pure sceneThumbnail(document, { scheme }) function turns an app's document into a small Scene-like picture as an SVG string, so a host can list apps without a browser."
criteria: [{"id":"c1","text":"When sceneThumbnail is called with a document and a scheme, sceneThumbnail shall return an SVG string showing the Scene's district layout and hues."},{"id":"c2","text":"While drawing a thumbnail, sceneThumbnail shall use no DOM and no React."},{"id":"c3","text":"Cloud shall draw its app tiles and template tiles with sceneThumbnail."}]
tags:
  - "graview-cloud"
  - "FR-74"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.8; staging live at staging.graview.cloud)"
priority: "medium"
---

A host listing apps wants a small Scene-like picture of each; Cloud draws its own iso tiles from each app's kinds with hueFor and copied shading.
