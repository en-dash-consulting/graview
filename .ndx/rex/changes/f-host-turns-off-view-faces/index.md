---
id: "c90a3787-4624-4d4b-ad4f-2d3822152a94"
type: "change"
title: "A host can refuse a view's own @font-face faces while lent faces still draw"
slug: "f-host-turns-off-view-faces"
intent: "Nick 2026-11-11: a host that lends views only a list of web fonts needs a way to refuse a view's own @font-face faces. Ask: a host option on mount / the shell, and in sanitizeStylesheets for the worker view path, that refuses a view's own faces, said as a problem the view's author can read, while lent faces still draw."
acceptanceCriteria:
  - "With the option on, a view's own data: @font-face is dropped from the sheet and the frame HTML and reported as a problem with a code (test)"
  - "Lent faces still draw with the option on (harness)"
  - "With the option off, a view's own faces draw as before (test)"
touches:
  - "5fd9c76f-1dc7-477f-8e1a-4130f74102df"
priority: "medium"
tags:
  - "graview"
  - "guest"
  - "core"
  - "hq:feature:f-host-turns-off-view-faces"
source: "Graview HQ feature:f-host-turns-off-view-faces"
---
