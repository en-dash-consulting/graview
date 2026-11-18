---
"@graview/core": patch
"@graview/ship": patch
"@graview/tools": patch
"@graview/skills": patch
---

An owner can move a person bound to the wrong record, and what they did, to the right one. An account bound to the wrong person who had acted there stayed so: taking the binding back is refused once its seat has acted as the record, and an ended binding keeps both the account and the record from anybody else. `rebindPerson(store, person, record, { author })` on `@graview/core/binding` runs a new act the framework keeps for itself, `rebind-person` (`{ seat, from, to }`), as the host's system seat, the seat that binds:

- the seat is `record` from now on (`$me`, `own`, `self`), and the record it was bound to is nobody's again, which `mayBind` says may be bound and `bindPerson` binds;
- every act the seat did as the old record is said as the new one, to every reader, and counts as the new record's wherever a binding asks who acted as whom;
- it is one change, which undo takes back whole: the old binding, and who did what. Taking it back is refused, in words, once the record it left is somebody else's.

The log stays append-only: the move is one op of its own, and who did what is read forward through it, so no earlier op is rewritten. What the acts wrote stays as they wrote it. The record moved to must be of the people and nobody's; anything else is refused in a sentence a host can show. Every other seat is refused: the owner, the person moved, an agent, the app's own actor and a workflow. `graview check`, a compile and an edit refuse a grant that names `rebind-person` (`grant-gives-binding`) and an app's own act of that name (`binding-act-taken`), as they do `bind-person`. `REBIND_PERSON` and `isBindingAct` are on `@graview/core`. The `graview-sight` skill names it. Held by a unit test of core (`an-owner-can-move-a-person-to-the-right-record`).

Compatibility: the declaration and check finding codes — `rebind-person` is a name the framework keeps: an app's act of that name is refused as `binding-act-taken`, and a grant of it as `grant-gives-binding`; no code is added. Ops and primitives — unchanged: the move is a `rebind-person` op of two `patch-node` primitives on the seat mark, and an undo of it is refused while the record it would put the seat back on is somebody else's. Stored formats, the wire, and derived tool names and input schemas — unchanged; the act is offered by no list and no agent tool. What Graview Cloud does: call `rebindPerson` from the host's own seat where an owner says a member was bound to the wrong person.
