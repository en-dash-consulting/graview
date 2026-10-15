---
"@graview/core": patch
"@graview/skills": patch
---

A misnamed kind or field is told both naming rules and its right name. A document's kinds, acts, rules and roles are kebab-case (`tool-note`) and its fields and relations camelCase (`supersededBy`), and the checker said one rule at a time, so the first write met the trap twice. Now a refusal of either says both, and its fix names the spelling it wants: `kinds.toolNote` is told `Call it "tool-note"`, a field `superseded-on` `Call it "supersededOn"`, and a value naming a kind (`"creates": "toolNote"`) the same. The JSON Schema says both rules wherever a kind, an act, a rule, a field or a relation is named, and `graview-new-app` and `graview-node-kind` teach them together. The name is not respelled for the author: a kind's name is stored in every record a seed and a log hold, and names its derived acts (`add-tool-note`), so a document quietly normalized would disagree with its own seed and data.

Compatibility: the declaration and check finding codes: what compiles is unchanged; the `shape` findings' messages for a name say both rules, and those refusing a name carry a `fix`. Ops, stored formats, the wire and derived tool schemas are unchanged.
