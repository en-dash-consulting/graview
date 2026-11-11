---
"@graview/core": patch
"@graview/ship": patch
"@graview/tools": patch
"@graview/guest": patch
"@graview/skills": patch
---

A person entered before they joined is the one who joins (Roadmap f-invite-binds-existing-person). An organizer enters people first, as records of the app's people kind with their links — a household, a list — and when one of them accepted an invitation, a second record was made for their membership and the organizer merged the two by hand. A host now binds the joining account to the record already there: `bindPerson(store, joining, record, { author })`, on a new host's entry, `@graview/core/binding`, where `joining` is the seat as the host will serve it (its account, and the profile it acts as, if any). From then on `$me`, an `own` or `via` sight, a `self` or `ownEnd` grant, an act done as the seat (`ctx.me`), a worker view's `props.me` and the name Activity gives its acts are that record, and no second person is made — for an account and for a profile's person alike. `store.personOf(principal)` says who `$me` is for a seat.

The binding is an act, `bind-person` (`BIND_PERSON`), answered by every store with a people kind once the host loads `@graview/core/binding`, and offered by no list: one op, blamed on whoever bound it. Binding is held to the people who run the app: the host's own seat, or a role the policy grants `bind-person` by name. It is refused in a sentence a host can show (`ActRefusal`) for a record that is already someone else's, a record of a kind that is not the people, and an account already bound to a different record or with a record of its own. A `graview check`-style finding, `person-seat-shared`, says where a graph holds two people bound to one account. Every answer kept for a seat is worked out as it is bound now. The `graview-sight` skill says the shape.

A hosted page carries 5.9 KB more up front, and one handed a compiled app 5.7 KB more, under raises of their budgets: every store reads a seat as it is bound now, and serves each seat what it may be told of who is bound. Every face, the pages face, a visitor's form, the guest host's chunks and Cloud's worker grow with it, under raises of their budgets.

Tests: `a member is bound to their person` (core), `a guest is never handed the seat a person is bound to` (guest).

Compatibility: ops and primitives — a new act, `bind-person` (args `record`, `seat`), whose op patches a people-kind record's `$seat` mark; every other op is unchanged. Stored formats — a record of the people kind may carry `$seat`, a string, and the kind's JSON Schema says so; an export, a seed and a template carry none. The wire — `bind-person` goes over it like any call; nothing else a client is sent changes. The declaration and check finding codes — one new graph finding, `person-seat-shared`; an act may not set a field whose name begins with `$`. Derived tool names and input schemas — unchanged: `bind-person` is offered on no list and to no agent.
