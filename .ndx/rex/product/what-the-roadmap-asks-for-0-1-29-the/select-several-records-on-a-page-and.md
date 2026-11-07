---
id: "dd0e99fc-d01d-4a2d-ba1d-af9b10d8b6e4"
type: "capability"
title: "Select several records on a page and act on them at once"
slug: "select-several-records-on-a-page-and"
statement: "A page lets a person select several records on list, board and kind-stop pages and act on them at once."
criteria: [{"id":"c1","text":"When a person uses a list, board or kind-stop page, the page shall let them select records with a checkbox column on a desk, a long-press on a phone, Shift-click ranges, or the keyboard."},{"id":"c2","text":"When several records are selected, the page shall offer once each act that every selected record shares."},{"id":"c3","text":"When a person runs a shared act on a selection, the page shall run it as one batch with one undo."},{"id":"c4","text":"If an act is refused for records in a selection, the page shall name each refusal per record."},{"id":"c5","text":"While records are selected, the page shall announce the selection to assistive technology."},{"id":"c6","text":"The page shall keep selecting records and acting on the selection operable from the keyboard."}]
tags:
  - "roadmap"
  - "0.1.29"
  - "f-bulk-acts-pages"
source: "Nick, 2026-10-14: \"i think any that can be picked up should be picked up.\""
priority: "high"
resolution: "Shipped on feat/act-on-several: boxes, Shift ranges, Cmd/Ctrl-A, Space, Escape and a long press choose records on the pages list, the kind stop and a status board; a bar fetched with the first one chosen offers the acts they share (actsForSeveral) and runs one as one batch with one undo (actOnSeveral), naming each refused record while the rest apply; a seat does the same with act_on_several."
---

Every act on a page is on one record; marking six tasks done is six rounds.
