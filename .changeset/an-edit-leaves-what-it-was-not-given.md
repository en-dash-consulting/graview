---
"@graview/core": patch
---

A change changes only what it names. The derived `edit-<kind>` asked for each field as optional over the field's own schema, and under zod 4 a field with a default filled that default when an edit left it out. So renaming a person set their role back to "member". An edit now asks for each field without its default: a default is what a record is made with, not what an edit fills in.

Compatibility: derived tool names and input schemas — an `edit-<kind>` input no longer carries its fields' defaults (no recorded conformance fixture changes); stored data — an edit no longer overwrites a field it was not given.
