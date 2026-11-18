---
"@graview/core": patch
"@graview/skills": patch
---

A rule's `today()` and `date()` read the day in the app's own time zone. A composed dated list says `where not (starts < today())`, and an instant was compared with the day by its letters, on UTC's calendar: at half past midnight in New York an event from 10 PM the evening before still read as ahead, and just after midnight in Tokyo an event at 8 AM that day read as gone. With `brand.timeZone` declared:

- `today()` is the date there wherever the rule language is read: a document's rules, computed fields, labels, act conditions and values, a view's blocks and a template, and an expression evaluated with a `timeZone` and no `today` of its own;
- `date(x)` of an instant is the day it is on there (`date('2026-10-17T03:30:00Z')` is `2026-10-16` in New York); a day, a month or a year alone, and a wall time written without a zone, keep the day written;
- an instant compared with a day, a month alone or a wall time (`<`, `<=`, `>`, `>=`) is read on the app's clock, so `starts < today()` turns at the app's midnight, as a store with the app's zone is ticked (`tickEachDay`, `openStore`, `openRemote`).

An app that declares no zone reads all three on UTC's calendar, as before. Two instants are compared as before. The `graview-locale` skill says the zone is the app's day too. Held by a unit test of core (`a-rules-day-and-date-are-read-in-the-apps-zone`): New York at 23:30 and Tokyo at 00:30, both sides of each midnight, `date()` of an instant, the comparison, a document without a zone, and a clock rule judged again at New York's midnight and not UTC's. A hosted page carries 0.3 KB more up front (286 / 30 bytes), 0.3 KB more handed a compiled app (290 / 28), and 340 bytes more before its scene face draws.

Compatibility: the declaration and check finding codes — a document that declares `brand.timeZone` reads `date()` of an instant, and an instant compared with a day, on that zone's calendar rather than UTC's, so a rule or a computed field over a datetime may answer differently within hours of midnight; nothing is renamed, and no finding is added or taken away. Ops and primitives, stored formats, the wire, and derived tool names and input schemas — unchanged. What Graview Cloud does: nothing; an app with a zone reads its own day.
