---
"@graview/primitives": patch
---

A record added and then taken back is named in Activity's adding row, never shown by its id. Cloud's vendors demo added a vendor, took it back, and the row that added it said "vendor:scene-way-one": a removal carried the record's name, an add did not. Activity now names every record it lists from whatever the log carries whole — the add that made it or the removal that took it, in that change or a later one.

Compatibility: no surface changes.
