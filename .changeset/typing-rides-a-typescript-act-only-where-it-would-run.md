---
"@graview/core": patch
"@graview/primitives": patch
---

Typing into a field rides a TypeScript act that writes it only where that act would run on the record. A keystroke (`type-text`) rode an act only while its declared rule (`allowedWhen`, `allowedOn`) held, but a TypeScript act whose rule lives in its `apply` — it throws `ActRefusal` for a published note — said nothing against it, so a seat refused "Revise" on a published note typed the body over all the same. Such an act is now asked: it is run on the record with the field's own value, against a context that writes nothing, and a refusal by its own rule (an `ActRefusal` whose reason is not `invalid`) keeps typing out; an `invalid` one ("nothing to change"), or an argument the record does not hold, does not. An act whose rule reads an argument a keystroke never hands it says its rule about the record as `allowedOn`, which is believed and the act not run. The live editor asks the store the same question before it takes a keystroke, and where no act would run it is read only and says so, rather than taking typing the store refuses. `a-keystroke-rides-a-typescript-act-only-where-it-would-run.test.ts` holds it.

Compatibility: ops and primitives, stored formats, the wire, the declaration, check finding codes, and derived tool names and input schemas — unchanged. A seat that typed into a record through a TypeScript act whose `apply` refuses that record is now refused the keystroke, as it was refused the act.
