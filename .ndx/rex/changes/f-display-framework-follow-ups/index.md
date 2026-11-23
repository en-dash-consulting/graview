---
id: "94d2177d-b163-49b2-adf8-d46626e5fb44"
type: "change"
title: "Display devices, framework follow-ups: resolveTap returns the act, renderScreen draws a reader's view, a tap notice"
slug: "f-display-framework-follow-ups"
intent: "From HQ feature:f-display-framework-follow-ups (Cloud built display devices): (1) resolveTap returns the act it would apply instead of applying it (Cloud catches store.apply with a Proxy today); (2) renderScreen draws what a reader is served (the published view) so a device can be paired at a lower seat; (3) a notice option on renderScreen so a tap's outcome shows on the screen."
acceptanceCriteria:
  - "resolveTap returns the act it would apply and applies nothing (test)"
  - "renderScreen as a reader draws only what that seat is served (test)"
  - "renderScreen with a notice draws it on the screen (test)"
priority: "medium"
tags:
  - "graview"
  - "pages"
  - "hq:feature:f-display-framework-follow-ups"
source: "Graview HQ feature:f-display-framework-follow-ups"
---
