---
"@graview/core": patch
"@graview/primitives": patch
---

A field called `label` is an ordinary field where a kind is named by another. A release kept its record label in a field called `label` ("Parlophone") and was named by its `name`, and every release in a coverage grid read "Parlophone": the grid took a record's `label` value before the kind's own naming. The grid, in the lens and in `describePlace`, now names a row as everything else does, by the kind's label. A kind with no label template is named by `name`, then `title`, before a field called `label` among the fields that could name it (required ones first, as before), and a `label` field the kind is not named by is said as "Label" and shown among the record's facts like any other field; a kind named by `{label}` keeps it as its name.

Compatibility: ops and stored records are unchanged. A document kind with no `label` template whose fields include both `label` and `name` or `title` among the same required (or unrequired) word fields is now named by `name` or `title` where it was named by `label`; a kind that names itself with a template, or whose only such field is `label`, is named as before. `defaultLabelField` says the new order.
