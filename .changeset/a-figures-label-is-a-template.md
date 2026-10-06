---
"@graview/core": patch
"@graview/skills": patch
---

A figure's label is a template (FR-99). `{ "figure": "net", "as": "money", "label": "{name}, net" }` says the record's name, through the same template engine, formatters and budget as a headline, and so does a meter's (`progress`) label. `resolveBlocks` works the label out, so the faces draw it and `describePlace` says the same words, and a label that cannot be worked out says "—" and is a problem at its path, as a headline's would be. The check holds a label to the names its kind has, and a rename rewrites a label that names what it renames (a removal drops the label and keeps the figure). Where a block's words are not a template (a field's label, what an empty list says, a group's heading), braces would have been drawn as written, and the check now says so with a `view-braces` warning at the block's path. The `graview-node-kind` skill shows a templated label. `capabilities().shipped` names FR-99.

Compatibility: additive within `graview-document@1` and to the check finding codes. A figure's or a meter's `label` was plain words and is now a template: a label without braces says exactly what it said, and one with braces, which was drawn with them, now says the value they name. A figure's label may now be up to 300 characters, as a template may. `view-braces` is a new warning code. The wire: `capabilities().shipped` gains `FR-99`. Ops, stored formats and tool schemas are unchanged.
