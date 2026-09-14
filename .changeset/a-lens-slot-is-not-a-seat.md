---
"@graview/studio": patch
---

A lens's binding slots are not roles somebody can hold.

Two different things share the word "role". A policy role is a seat — coordinator, volunteer, viewer. A lens's `requiredRoles` are the binding SLOTS it asks an app to answer with its own fields and kinds — `start`, `end`, `rows`, `columns`, `link`. `declarationToGraph` read both into the studio's `role` kind, so opening the studio on Rota showed a ROLES district of eight, five of which nobody could ever be.

The display was the smaller half. `graphToDeclaration` builds `policy.roles` from those same nodes, so applying the studio handed back a policy declaring eight roles, and the `policy.ts` it writes said `roles: ["coordinator", "volunteer", "viewer", "rows", "columns", "link", "start", "end"]` — a checkout where `permits` would recognise "columns" as a seat a person could be granted. A lens's slots now live on the lens node as a field of its own, and the `requires` edge to `role` is gone.

Fixing the fixture that hid this — a coverage lens declared as requiring "coordinator" — surfaced a second thing: a lens's bindings are carried from the checkout verbatim, because no studio act writes one, so renaming `plot` to `bed` left the coverage grid bound to a kind nothing declares and `graview check` refused the rename with an error about a lens nobody had touched. Bindings now follow a rename the way an act's subject does, and a lens naming something that has been deleted is dropped whole rather than left half-bound — the rule this file already keeps for display labels: what refers to something gone is not preserved, it is meaningless.
