---
id: "431e6ad4-a67a-4603-82a5-8bb75e053216"
type: "change"
title: "Right-click in a custom view suggests for the record under the pointer, not the whole view"
slug: "f-view-menu-suggests-under-pointer"
intent: "From HQ feature:f-view-menu-suggests-under-pointer (Nick, 2026-11-23): right-clicking on things in a custom (worker) view gives suggestions for the entire view, not for what the mouse is over. A right-click or long press inside a worker view resolves the record (or field) under the pointer (an <a data-record>, a card or row bound to a record, a record box) and the menu's Suggested rows, AI section and hover chip are about that record; only a press on the view's empty space falls back to the view's place."
acceptanceCriteria:
  - "A right-click on a record's card inside a worker view opens a menu whose Suggested rows and AI section are about that record (test and harness claim)"
  - "A right-click on empty view space keeps the view's place suggestions (test)"
  - "The same holds for a long press on a phone (harness claim)"
  - "The hover chip over a record in a worker view is about that record (test)"
priority: "medium"
tags:
  - "graview"
  - "primitives"
  - "guest"
  - "tools"
  - "hq:feature:f-view-menu-suggests-under-pointer"
source: "Graview HQ feature:f-view-menu-suggests-under-pointer"
---
