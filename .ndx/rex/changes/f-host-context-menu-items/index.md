---
id: "b8483dc2-7753-4510-9274-6d64ab72e0b5"
type: "change"
title: "A host adds its own rows to the right-click menu, run with what is under the pointer and the app's link"
slug: "f-host-context-menu-items"
intent: "Graview Cloud's \"Make changes in your own AI\" belongs in the right-click menu (`packages/pages/src/context-menu.tsx`, and the scene's). `menuSections` lets a host add a section, but it is told a `MenuTarget` and has to work out the record, the place and the app's address itself. A host option on `mount`, the provider, the Shell and `PagesApp` gives rows that the framework draws after its own and runs with the record id or place slug under the pointer, plus the app's link."
acceptanceCriteria:
  - "`menuItems` on `mount`, `GraviewProvider`, `Shell` and a `PagesApp` context draws each host row after every row of the framework's, on both faces (test)"
  - "A host row is run with the record id under the pointer, or the place slug, and the app's link; `offered` leaves it out where it does not apply (test)"
  - "A host row is a labeled button the keyboard reaches, and is offered when a phone's long press opens the menu (test, and the menu harness)"
  - "The menu harness holds a claim that the host's row comes last and is run with the record and the app's link, at a desk's width with the keyboard and at a phone's with a resting finger"
touches:
  - "4ef9f01c-fb75-4091-9e17-5d1e4a73816c"
priority: "medium"
tags:
  - "graview"
  - "react"
  - "pages"
  - "primitives"
  - "embed"
  - "hq:feature:f-host-context-menu-items"
source: "Graview HQ feature:f-host-context-menu-items"
---
