---
"@graview/core": patch
---

An act that makes something is not guessed to change its subject. A TypeScript act that declares no `writes` is read as writing each argument named like a field of its subject; "Report a fault" acts on a tool and is told the fault's `label`, so it was taken for the act that renames tools — a tool's name changed in place reported a fault by that name, the tool's derived edit left the name out, and every role allowed to report a fault rode that derived edit to change any of the tool's other fields. `fieldsWrittenBy` now reads an act that `creates` something and declares no `writes` as writing nothing on its subject; one that does write its subject says so in `writes`. (W-180, the eighth walk.)

Compatibility: ops, stored formats, the wire, the document format, the compiled format and check finding codes are unchanged. Tool names and input schemas: `edit-<kind>` may take a field it left out before, where the only act told that field's name makes something else and declares no `writes`; such an act no longer permits `edit-<kind>`. What a host does: nothing, unless an act that creates a record also writes its subject without saying so — give it `writes`.
