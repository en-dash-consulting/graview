---
id: "1b17c8c4-a45a-451f-81bc-fbc3cb1e6b5b"
type: "change"
title: "A member who joins is bound to the person entered for them"
slug: "f-invite-binds-existing-person"
intent: "HQ, 2026-11-11: an organizer enters people first as records of the app's people kind, with their links; when one of them joins, a second record is made for their membership and the organizer merges the two by hand. Ask: a way for the host to bind a joining account to the existing person record, as an op, so $me, ownership and acts done as them resolve to it and no duplicate is made."
acceptanceCriteria:
  - "A host binds a joining account to an existing person record (store.bindPerson), as a named act (bind-person) in the log, blamed on whoever bound it and undone like any act (test)"
  - "After a binding, $me, own sight, self grants, acts done as the seat and the name Activity says resolve to the bound record, and no second person is made, for an account and for a profile (test)"
  - "A binding is refused in a sentence for a record already bound to another account, a record of another kind, and an account already bound to a different record or with a record of its own (test)"
  - "Binding is held to the people who run the app: the host's system seat or a role the policy grants bind-person by name, and no seat ever binds itself (test)"
  - "After a binding and after its undo, the kinds kept from the seat, its seat view held across both, and its served log are judged as the seat is now, and a seat's own claim to a binding is never believed (test)"
touches:
  - "90b438f3-5664-45a5-9902-564a6b0b011c"
priority: "medium"
tags:
  - "graview"
  - "core"
  - "permissions"
  - "hq:feature:f-invite-binds-existing-person"
source: "Graview HQ feature:f-invite-binds-existing-person"
---
