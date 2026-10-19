---
"@graview/core": patch
---

The date editor reads an instant as a record keeps one. A film festival's screening is kept as `2026-10-20T15:00:00-05:00`; pasted into its own "Starts" box, on the act's form or the record, it said "Not a date this reads", so the form would not send and "Schedule a screening" could not be done that way on either face. `readWhenTyped` now reads a stored instant whole — with its seconds, a `Z` or an offset — on the reader's clock, as the value is said, and a wall time with its seconds (`2026-10-20T15:00:00`) as the day and time it names.

Compatibility: no surface changes; text the editor refused before it may now read.
