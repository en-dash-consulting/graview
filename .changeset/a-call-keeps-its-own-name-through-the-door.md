---
"@graview/primitives": patch
---

A call read through a `Door` keeps its own `as`: when the gate dropped an earlier call the app does not know, the names were read back from the answer by position, so a later call took the dropped call's name and the call after it took that one's, and a `{ $plan }` reference pointed at the wrong node.
