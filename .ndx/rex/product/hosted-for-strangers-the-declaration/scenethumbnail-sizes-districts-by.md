---
id: "3b4a5407-d714-4d4d-904b-3a3a7cbcc110"
type: "capability"
title: "sceneThumbnail sizes districts by counts the way the live Scene does (FR-103)"
slug: "scenethumbnail-sizes-districts-by"
statement: "sceneThumbnail accepts an optional per-kind count map and sizes each district by those counts the way the live Scene does, so a thumbnail carries the density of the live view."
criteria: [{"id":"c1","text":"When an optional counts record mapping each kind to a number is passed, sceneThumbnail shall size each district by those counts the way the live Scene does."},{"id":"c2","text":"sceneThumbnail shall draw a tile that Cloud's app list can use in place of its own tiles without visual loss."}]
tags:
  - "graview-cloud"
  - "FR-103"
source: "Graview Cloud, 2026-10-06 (brief after 0.1.10)"
priority: "low"
---

Without counts Cloud's tiles would be sparser than its current ones.
