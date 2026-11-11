---
"@graview/core": patch
"@graview/tools": patch
"@graview/guest": patch
"@graview/skills": patch
---

A person entered before they joined is the one who joins (Roadmap f-invite-binds-existing-person). An organizer enters people first, as records of the app's people kind with their links — a household, a list — and when one of them accepted an invitation, a second record was made for their membership and the organizer merged the two by hand. A host now binds the joining account to the record already there: `store.bindPerson(joining, record, { author })`, where `joining` is the seat as the host will serve it (its account, and the profile it acts as, if any). From then on `$me`, an `own` or `via` sight, a `self` or `ownEnd` grant, an act done as the seat (`ctx.me`), a worker view's `props.me` and the name Activity gives its acts are that record, and no second person is made — for an account and for a profile's person alike. `store.personOf(principal)` says who `$me` is for a seat.

The binding is an act, `bind-person` (`BIND_PERSON`), answered by every store with a people kind and offered by no list: one op, blamed on whoever bound it, undone like any act, after which the seat is nobody's record again. It marks the record with the seat (`PERSON_SEAT`, `$seat`, a mark like archived: never a field, kept through a restore and a migration while the kind is still the people). Who may bind is the policy's — a grant of `bind-person` by name or every act, never a `self` or `ownEnd` grant, never riding another act — or the host's system seat; a seat never binds itself, whatever it is granted. It is refused in a sentence a host can show (`ActRefusal`) for a record already bound to another account or that is another account's own, a record of a kind that is not the people, and an account already bound to a different record or with a record of its own; binding an account to the record it is bound to changes nothing. Only somebody who signed in can be bound: a shared seat, a visitor and an agent acting for nobody cannot.

Every answer kept for a seat is worked out as it is bound now, read from the graph as it is asked: a seat's view held across a binding and its undo, its served log, the fields a sight keeps from it, the kinds kept from it, and what it may do. A binding a caller claims for a seat is never believed. The `graview-sight` skill says the shape.

A hosted page carries 3.9 KB more up front, and one handed a compiled app 3.9 KB more, under raises of their budgets: every store answers `bind-person`, and judges a seat as it is bound now. Every face, the pages face, a visitor's form, the guest host's chunks and Cloud's worker grow with it, under raises of their budgets.

Tests: `a member is bound to their person` (core).

Compatibility: ops and primitives — a new act, `bind-person` (args `record`, `seat`), whose op patches a people-kind record's `$seat` mark; every other op is unchanged. Stored formats — a record of the people kind may carry `$seat`, a string, and the kind's JSON Schema says so; nothing else stored changes. The wire — `bind-person` goes over it like any call; nothing else a client is sent changes. The declaration and check finding codes — unchanged. Derived tool names and input schemas — unchanged: `bind-person` is offered on no list and to no agent.
