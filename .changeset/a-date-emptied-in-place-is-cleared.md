---
"@graview/primitives": patch
"@graview/tools": patch
---

A date emptied where it is shown is cleared (Roadmap f-clear-date-in-place). Since 0.1.56 `null` clears a field a record may be without on a derived edit, but the page's in-place editor sent nothing when a person emptied a date, so a wrong date could be changed and never removed. Now emptying a field in place — a date first, and any field that can be emptied: words, a number, an amount — sends the edit `null` where the act clears that field, and the record has none, one change that can be undone; an emptied number is no longer read as zero. A field the record cannot be without keeps its value and says so beside it: `Name can't be empty; it keeps APT1.` An editable field from `@graview/tools/edit` says which with `clearable`: true where its act takes `null` for that field (a derived edit's `clearable`). Primitives' test empties a date in place and the record then has none, empties a text and a number the same way, and finds a required name kept with its sentence.

Compatibility: unchanged on every surface. `EditableField` gains `clearable`, an addition.
