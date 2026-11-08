---
id: "1a92a870-098c-430d-ae0d-ba38b748baee"
type: "capability"
title: "Repeating dates: a weekly practice, a monthly bill"
slug: "repeating-dates-a-weekly-practice-a"
statement: "A date field in the product can repeat (weekly, monthly, on a list of weekdays, or until a date), so a practice, rota or bill is one record with a rule instead of one record per occurrence."
criteria: [{"id":"c1","text":"A date field shall accept a repeat declared as weekly, monthly, a weekday list, or with an until limit."},{"id":"c2","text":"The calendar lens shall draw the occurrences of a repeating date."},{"id":"c3","text":"While a date repeats, today(), the timeline and the kind shall each read the next occurrence."},{"id":"c4","text":"When an act skips one occurrence of a repeating date, the product shall skip it without rewriting the repeat rule."},{"id":"c5","text":"When an act changes a repeating date from a given occurrence onward, the product shall apply the change from there without rewriting the repeat rule."}]
tags:
  - "roadmap"
  - "0.1.29"
  - "f-recurring-dates"
source: "Nick, 2026-10-14: \"i think any that can be picked up should be picked up.\""
priority: "medium"
resolution: "Shipped on feat/repeating-dates: a date or datetime field with repeats: true (repeatField() in TypeScript) keeps its first occurrence and, beside it as <date>Repeat, every/interval/on/until/count/except; rules, today(), sorting, the kind stop and words read the next occurrence, the calendar draws each one marked, and skip-, detach- and split-<kind> act on one occurrence with one undo each."
---

A date field is one moment; a practice, rota or bill is one record per occurrence made by hand.
