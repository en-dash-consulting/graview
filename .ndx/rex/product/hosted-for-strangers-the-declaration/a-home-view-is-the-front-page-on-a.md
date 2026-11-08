---
id: "3bc8aafe-7e98-4118-9cb4-42a07891baf6"
type: "capability"
title: "A home view is the front page on a desk too (FR-136)"
slug: "a-home-view-is-the-front-page-on-a"
statement: "When a worker view is attached to \"home\", the desk opens on it as the Home place instead of floating it over the scene."
criteria: [{"id":"c1","text":"When a view is attached to \"home\", the desk shall open on it as a place titled \"Home\", listed first."},{"id":"c2","text":"When a view is attached to \"home\", the desk shall draw the Home place at full width under the bar, with the overview one tab away."},{"id":"c3","text":"The desk shall not float a home view over the scene."},{"id":"c4","text":"While no view is attached to \"home\", the desk shall open as it did without a home view."}]
tags:
  - "graview-cloud"
  - "FR-136"
  - "design"
source: "Graview Cloud, 2026-10-08 (brief after 0.1.16)"
priority: "high"
resolution: "Shipped in #143 (0.1.17): an app with a home view and no other pages.first opens on Pages at its home when the host names no face, on a desk as on a phone, and at the bare address under address routing; the scene's home landing is gone. The review after 0.1.16 put the app's description under the home's own headline instead of over it."
---

A worker view with attach: 'home' draws as a card over the scene at the top right on a desk; on a phone it's the home. Nick asked for 'a custom front page'.
