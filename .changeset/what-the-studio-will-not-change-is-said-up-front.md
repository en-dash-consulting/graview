---
"@graview/studio": patch
"@graview/skills": patch
"@graview/core": patch
---

What the studio will not change is said up front (FR-62). The studio keeps how a number is shown (a `format`), what it is counted in (a `unit`) and what a list holds (its `of`), and refuses to retype a field that carries one rather than guess what the new type does to it — but a host could learn that only by trying, so Graview Cloud copied the rule into its builder (`studioLeaves`) to warn first. Now `@graview/studio` exports `uneditable(document)`: one finding per field property the studio keeps but will not change, a `note` at the field's path with the code `studio-keeps-format`, `studio-keeps-unit` or `studio-keeps-item-type` and the sentence "vendor's quote is shown as money; the studio keeps that as it is and will not change it, nor retype the field". On Cloud's vendors it names `kinds.category.fields.budget` and `kinds.vendor.fields.quote`. `keptBy(field)` is the rule for one field, and the studio's own refusal to retype now reads it, so what is said ahead and what is refused are one rule in the same words. The graview-studio skill says to ask. `capabilities().shipped` names FR-62.

Compatibility: the wire — additive: `capabilities().shipped` gains `FR-62`. `uneditable`, `keptBy` and `KeptProperty` are new exports of `@graview/studio`. The `studio-unsaid` refusal to retype is unchanged in code, path and words. Ops, stored formats, check codes and tool schemas are unchanged.
