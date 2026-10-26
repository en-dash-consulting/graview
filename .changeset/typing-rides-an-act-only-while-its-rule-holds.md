---
"@graview/core": patch
---

Typing into a field rides an act that writes it only while that act could run on the record. A keystroke (`type-text`) is permitted to whoever may run an act that writes the field, and was whatever that act's own rule said of the record: an author who may revise a post's body only while it is a draft (`allowedWhen: "status == 'draft'"`) was refused "Revise" once the post was published, and typed the whole body over all the same, on every served store. A keystroke now rides only an act whose module is on and whose condition holds for the record as the seat is served it; a seat the policy grants typing itself, or every act, types as before. A document act carries its condition as `allowedOn(graph, subject)`, judged without the call's arguments (a condition that needs one does not lend typing), and a TypeScript act that refuses by its own rule may say it there too. `typing-rides-an-act-only-while-its-rule-holds.test.ts` holds it.

Compatibility: ops and primitives, stored formats, the wire, and derived tool names and input schemas — unchanged. The declaration and check finding codes — unchanged; a compiled act with `allowedWhen` carries `allowedOn` beside its other members, and `MutationDefinition` may declare it.
