---
"@graview/pages": patch
---

A form asks the question the act left open. `DerivedForm`'s node picker listed every node of the kind, ignoring the candidates the affordance had already narrowed — so a record's own "depends on" offered the record itself, and an act that hands something on offered whoever already had it. The derived record page now passes `affordance.open` through; a form with no act behind it (a rule's repair, a list page's creating act) still offers every node of the kind, which is the honest answer there.
