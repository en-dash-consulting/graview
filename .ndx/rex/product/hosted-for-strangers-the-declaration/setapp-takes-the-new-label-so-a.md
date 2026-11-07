---
id: "6285c90b-5729-425e-99f5-777eb825b40c"
type: "capability"
title: "setApp takes the new label, so a renamed app says its new name without a reload (FR-128)"
slug: "setapp-takes-the-new-label-so-a"
statement: "When an app is renamed, setApp takes the new label so the open page's heading shows the new name without a reload."
criteria: [{"id":"c1","text":"When setApp is called with a new label (or setLabel is called), the app shall take the new label in place of the first mount's label."},{"id":"c2","text":"When the app is renamed through a chat with set-name, the open page's heading shall show the new name without a reload."}]
tags:
  - "graview-cloud"
  - "FR-128"
source: "Graview Cloud, 2026-10-07 (handoff: brand and theme an app from a chat — docs/framework-handoff-branding.md)"
priority: "medium"
resolution: "Shipped in #131 (0.1.16): a label that was the app's own name follows the app through setApp, setApp takes { label }, and handle.setLabel and handle.setHostActions rename the embed and change the host's actions in place."
---

setApp keeps the first mount's label, so a rename shows the old name until a reload.
