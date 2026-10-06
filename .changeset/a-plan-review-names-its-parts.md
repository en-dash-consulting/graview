---
"@graview/primitives": patch
---

A `PlanReview` names its parts: each row is `data-graview-part="plan-row"`, and the presses are `plan-decline`, `plan-apply` and `plan-discard` inside `plan-actions`. The struck-through row and the presses' size moved from style attributes to rules an app's own selector outranks, so a product dresses its review without `!important`, and with no sheet of its own the review looks as it did.
