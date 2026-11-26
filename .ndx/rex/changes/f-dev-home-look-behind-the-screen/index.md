---
id: "86a127ed-4438-45c8-a4ed-84accc820c43"
type: "change"
title: "graview.dev opens on 'Any agent can draw the screen. Look behind it.', and every page of the site wears the same design"
slug: "f-dev-home-look-behind-the-screen"
intent: "From HQ feature:f-dev-home-look-behind-the-screen and request:graview-dev-home-look-behind-the-screen (Nick, 2026-11-26): replace graview.dev's home with the look-behind-the-screen map prototype (one canvas, three.js r128 vendored, the cursor's hole through a drawn app, scroll into a 3D map, six scenes, the prompt to copy, no-WebGL and reduced-motion fallbacks, phone width), and carry its design (Merriweather, Montserrat, JetBrains Mono served from graview.dev; night, navy, turquoise, paper; the framework's lockup; one header and footer) across the tour, progression, 404 and every docs page rendered by apps/site/design.mjs. Keep the prompt 'map this repo as a Graview app and show me what's in it' and make start.md handle it; keep the story's numbers as the page's own labeled example; take the facts from the site's numbers."
acceptanceCriteria:
  - "The home page draws the opening, the six scenes and the closing prompt, and every caption and link is in the DOM, readable without WebGL and with reduced motion (harness)"
  - "three.js and every font are served from graview.dev, pinned, with their licenses, and no page reaches a CDN except analytics on graview.dev itself (test)"
  - "The tested, skills, license and version facts on the home page are the site's numbers, not typed by hand (test)"
  - "start.md takes 'map this repo as a Graview app and show me what's in it' to a working app and a report (test or rehearsal)"
  - "The home, tour, progression, 404 and every docs page share one header, footer, type and palette (test)"
  - "Frame times at real speed are recorded on a desk and a throttled phone, and every page passes the watch in three engines at phone and desk widths (harness)"
priority: "high"
tags:
  - "site"
  - "hq:feature:f-dev-home-look-behind-the-screen"
source: "Graview HQ feature:f-dev-home-look-behind-the-screen"
---
