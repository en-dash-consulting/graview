---
"@graview/core": patch
---

A sight names a field as the kind spells it. A document's fields are one word or camelCase (`startsAt`), so a rule says them bare, but a sight's `fields` and `hide` were read as kebab-case names, like a kind's: a sight could keep `title` from a role, never `startsAt` or `payRate`, and was refused "field names are kebab-case" and told to call it "starts-at", a field no kind could have. They now take a field's name as a kind's `fields` do, and refuse what no field could be called (`pay-rate`, `id`). Core's tests hold it (`a-sight-names-a-field-as-the-kind-spells-it.test.ts`).

Compatibility: ops and primitives, stored formats, the wire, check finding codes, and derived tool names and input schemas — unchanged. The declaration: a sight's `fields` and `hide` take camelCase field names, and no longer take a kebab-case name, an `id` or a `kind`, which named no field. What Graview Cloud does: nothing.
