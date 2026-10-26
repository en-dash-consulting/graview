---
"@graview/core": patch
---

An undo is judged as the change it makes, redo included. Undoing an act was judged as the act, asked again for whoever undoes it, but an op no act made was let through unasked — and every undo is one, so redo, the undo of an undo, put back an act its seat was refused: a guest refused "Publish" redid the admin's undone publish, over the wire as through `Store.redo`. Every change a host applied as primitives (an import, a sync, a connection, a repair) was anybody's to take back the same way. Now an undo of an undo is judged as the act at the root of its chain, with the rule that an act done as somebody else is theirs to take back, and a change no act made is taken back only by the system, by whoever made it, or by a seat the policy grants every act (`{ mutations: "*" }`, as every Graview Cloud app's everybody grant is); with no policy, anybody may, as before. `an-undo-is-judged-as-the-change-it-makes.test.ts` holds it.

Compatibility: ops and primitives, stored formats, the wire, the declaration and check finding codes, and derived tool names and input schemas — unchanged. An undo the policy would refuse as the change it makes is refused `forbidden`, "Not permitted to undo …", as an undo of a refused act already was.
