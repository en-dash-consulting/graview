---
id: "bd973f98-8ed7-4e26-9dc9-727159cb3ab8"
type: "change"
title: "F-013 · usePickTargets grants role=button to no SVG element"
slug: "f-013-usepicktargets-grants-role"
intent: "Found building Groundskeeper (../groundskeeper-graview), a ten-kind product on Graview. Full write-up with measurements: groundskeeper-graview/docs/graview-feedback.md, F-013. The GENERIC set is HTML tags only, so a drawn shape carrying data-graview-pick is focusable and announced as nothing."
acceptanceCriteria:
  - "g, polygon, circle, rect, path, ellipse, polyline and use are in GENERIC; takesButton keeps landmarks safe"
  - "A test renders an SVG pick target and asserts role=button"
  - "graview-lens says 'drawing in SVG? the framework sets role; you set aria-label'"
touches:
  - "7c58712a-1850-49b6-9a4c-d067eb6844bd"
priority: "high"
tags:
  - "groundskeeper-feedback"
  - "@graview/react"
source: "groundskeeper-graview/docs/graview-feedback.md"
---
