---
id: "eb680abe-316e-4efe-8185-226bdd48a451"
type: "capability"
title: "The embed has a place for a host's own actions, in the bar's profile menu (FR-72)"
slug: "the-embed-has-a-place-for-a-host-s-own"
statement: "The embed shows a host's own actions in the bar's profile menu, so a hosted app presents them there rather than in a menu floating over the scene."
criteria: [{"id":"c1","text":"When a host calls mount(root, { hostActions: [{ label, href }] }), the embed shall draw those actions in the bar's profile menu."},{"id":"c2","text":"The embed shall make the host actions in the bar's profile menu reachable by keyboard."},{"id":"c3","text":"The embed shall draw the host actions in the bar's profile menu in both the light and dark schemes."},{"id":"c4","text":"When a Cloud app is hosted, the profile menu shall show 'Change the app', 'Your apps' and 'Report this app'."},{"id":"c5","text":"A hosted Cloud app shall not draw any fixed-position surface over the scene."},{"id":"c6","text":"When the profile menu opens, the embed shall open it in the browser's top layer or in one documented layer above every panel, so that no other surface in the embed covers it."}]
tags:
  - "graview-cloud"
  - "FR-72"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.8; staging live at staging.graview.cloud)"
priority: "high"
---

Cloud draws its own <details> menu floating bottom right above the zoom control (reportLink in workers/cloud/src/routes/app.ts, changeLink in packages/client/src/shell.ts).
