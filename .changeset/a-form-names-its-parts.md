---
"@graview/pages": patch
---

A `DerivedForm` names its parts: the form, each field (with `data-graview-field` saying its control), its label, its control, a picker and its chevron, a group, a list's rows and its add and remove, the refusal and the submit each wear `data-graview-part`. Their look moved from style attributes to rules at one element's weight, so an app's `[data-graview-part="control"]` restyles every control without `!important`, and with no sheet of its own a form looks as it did.
