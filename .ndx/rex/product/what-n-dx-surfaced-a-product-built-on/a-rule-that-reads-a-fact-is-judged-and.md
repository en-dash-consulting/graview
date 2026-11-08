---
id: "e073ef87-a0ca-4573-b4be-351674331141"
type: "capability"
title: "A rule that reads a fact() is judged and worded over what the seat sees"
slug: "a-rule-that-reads-a-fact-is-judged-and"
statement: "A seat's rule violations and the lines that word them are worked out over the view that seat is sighted to, facts included, so a hidden record never changes what the seat is told."
criteria: [{"id":"c1","text":"When a rule reads a fact(), the product shall judge the seat's violations over the seat's sighted view, facts included."},{"id":"c2","text":"When a rule reads a fact(), the product shall write the seat's violation lines over the seat's sighted view, facts included."},{"id":"c3","text":"If a rule's message names a fact that a role may not see in full, graview check shall warn."},{"id":"c4","text":"While a record is hidden from a seat, the product shall leave that seat's violation lines unchanged by that record."}]
tags:
  - "n-dx"
  - "document"
  - "sight"
source: "The review round before 0.1.22 (#207), 2026-10-11"
priority: "high"
resolution: "Fixed in #216: a seat's problems are judged over what it sees, facts and lines included, an act's answer to a seat as it judges them, and graview check warns of rule-says-hidden-fact."
---

A rule reading fact() is judged, and its message written, over the whole graph, which can leak a hidden count to a seat.
