---
"@graview/studio": patch
---

The studio calls a sight via a relation what it is. A sight that shows a seat only the matches `givenBy` joins to them was drawn as "participant may see match", which reads as every match; it is now "participant may see their own match", as an `own` sight is.

Compatibility: unchanged. The declaration the studio writes back, and every other surface, are as they were; only a sight's label in the studio's own graph changes.
