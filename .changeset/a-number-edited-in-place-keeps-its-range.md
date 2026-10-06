---
"@graview/primitives": patch
---

A number edited where it is shown is asked for in its range (FR-114). The routed face's form, the workbench's answer box and the studio's agent panel put a field's `min`, `max` and `step` on their number inputs, but `EditableValue`'s did not, so its spinner stepped to 6 on a field that takes 1 to 5 and apply refused what the control had offered. It now carries them too.

Compatibility: unchanged for stored data, ops, the wire, the declaration and derived tool schemas; the in-place number input gains `min`, `max` and `step` attributes.
