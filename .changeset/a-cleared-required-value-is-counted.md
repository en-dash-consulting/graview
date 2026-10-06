---
"@graview/core": patch
---

A migration that clears a required value says the record will need it (FR-114). `planMigration` counted a required value as missing only when the change made the field required, so narrowing the range of a field that was already required — `set-range` taking `level` from 1–5 to 1–4 — cleared the 5s and said `missingRequired: 0`, and the plan's own patch was then refused by the graph ("does not match what strength declares"). A required value the change clears, by a narrowed range or a dropped option, now counts, and the plan says "1 required value would be missing; those records need it filled in."

Compatibility: unchanged for stored data, ops and the wire. `planMigration`'s `missingRequired` (and so `losesData`) now counts a required value the change clears; the primitives it plans are unchanged.
