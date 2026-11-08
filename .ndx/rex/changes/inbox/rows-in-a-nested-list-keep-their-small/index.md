---
id: "2226fcd0-7f7f-473d-ac8c-62e9f5d905ae"
type: "change"
title: "Rows in a nested list keep their small blocks whole (FR-113)"
slug: "rows-in-a-nested-list-keep-their-small"
intent: "At phone width a nested row's badge drew 'L…' and its progress label 'Prog…' / '4 of'."
acceptanceCriteria:
  - "In a row, the title wraps or shrinks before a badge or progress block truncates; a row too narrow wraps to a second line"
  - "The org app's skill cards at 390 px show \"Lv 3\" and \"3 of 5\" whole, on both faces"
priority: "medium"
tags:
  - "graview-cloud"
  - "FR-113"
  - "bug"
  - "design"
source: "Graview Cloud, 2026-10-06 (handoff: building En Dash Org through Claude, on 0.1.12)"
---

Migration suggestion (text claude-sonnet-5-5, not accepted): place on "Views as data: a card, a row and a badge declared rather than written, and drawn by the framework" (6633d590-603d-48de-8d40-45109246f757).
