---
id: "efd30a86-53cf-4e20-9d54-3eff2f4a1c83"
type: "capability"
title: "An app fills the phone after it turns (FR-165)"
slug: "an-app-fills-the-phone-after-it-turns"
statement: "An embedded Graview app measures the viewport itself and fills the phone's screen on both faces and in the Shell, including after the phone turns."
criteria: [{"id":"c1","text":"When mount is given height: \"viewport\", the embed shall measure the viewport height itself from innerHeight on resize, orientationchange and the visual viewport's resize, and again a beat after each."},{"id":"c2","text":"When mount is given a height in viewport units (vh, dvh, svh, lvh), including a var()'s fallback, the embed shall measure it the same way as height: \"viewport\"."},{"id":"c3","text":"The standalone Shell shall use the measured viewport height instead of 100vh."},{"id":"c4","text":"The pages' ask box shall follow the measured viewport height instead of a fixed 100dvh."},{"id":"c5","text":"When the scene's ResizeObserver reports a zero size, the scene shall follow its box again on the next non-zero report."},{"id":"c6","text":"While the on-screen keyboard is open, the app shall keep its height rather than shrink, and the documentation shall state this."},{"id":"c7","text":"When a phone is turned to landscape and back, the app shall fill the screen on both faces and in the Shell, in Chromium and WebKit."},{"id":"c8","text":"The hosted page's first load shall not grow because of viewport measuring."}]
tags:
  - "graview-cloud"
  - "FR-165"
  - "embed"
  - "phone"
source: "Graview Cloud, 2026-10-11 (the framework brief after 0.1.23; seen on Nick's phone)"
priority: "high"
resolution: "Shipped in #222, adding height: \"viewport\": the screen's height measured by useViewportHeight, paid for by moving the tool schema to @graview/core/json-schema."
---

The embed trusted the host's height once: both faces sat in a section of the height mount was given, the Shell was 100vh, the pages' ask box a fixed 100dvh, and the scene's ResizeObserver dropped zero-size reports. On a phone, after a turn, the app was drawn in the top half of the screen on both faces and stayed so. Cloud keeps --gc-viewport equal to innerHeight on its own page; the Shell and the ask box are the framework's.
