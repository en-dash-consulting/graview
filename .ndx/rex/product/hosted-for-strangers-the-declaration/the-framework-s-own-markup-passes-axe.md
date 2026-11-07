---
id: "9ee370c0-8e80-4df7-ae5c-887b1d6667f8"
type: "capability"
title: "The framework's own markup passes axe at desktop and phone, light and dark"
slug: "the-framework-s-own-markup-passes-axe"
statement: "The framework's own markup inside the app root of the example apps passes axe at desktop and phone sizes in both light and dark schemes."
criteria: [{"id":"c1","text":"When an example app is rendered at 1280x800 or 390x844 in light or dark scheme, axe (wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa and best-practice rules) shall report no violations inside the app root."},{"id":"c2","text":"A harness shall check that axe finds nothing inside the app root of the example apps at 1280x800 and 390x844 in light and dark."}]
tags:
  - "graview-cloud"
  - "accessibility"
  - "axe"
source: "Graview Cloud, 2026-10-10 (the framework brief after 0.1.20, ../graview-cloud/docs/framework-brief-0.1.21.md)"
priority: "high"
resolution: "All 48 were target-size: a showing's name on a district's signpost was 24 tall in the layout and drawn at its plane's 0.9, so 21.6 on the screen. A name's floor is 27 now, a fingertip as drawn; verify-a11y holds axe at nothing on Cloud's two shapes of app and every example, both faces, desk and phone, light and dark."
---

Cloud's accessibility pass (scripts/a11y.mjs) has reported 48 axe nodes inside #graview-app every release since 0.1.18 and tolerates them as the framework's.
