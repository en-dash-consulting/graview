---
"@graview/guest": patch
"@graview/skills": patch
---

A worker view, and a frame guest through its bridge, is told what its seat cannot see (Roadmap f-view-knows-what-its-seat-cannot-see). A view written by its owner could be an empty section for a signed-out visitor or a lower role, with nothing to tell it why. Where its seat is kept from some of what it reads, a worker view is now handed `props.unseen`: `kinds`, the kinds it reads that the seat sees none of, and `fields`, for each kind it sees, the fields the app's sight rules may keep from the seat (`hide`, `fields`), read from the policy and never from a record. Nothing of any record is handed — no count, no id, no value. A frame guest, somebody else's code, is handed `kinds` alone, of the kinds its own `reads` names, and no field. A view then says "Sign in to see the vendors" rather than drawing nothing.

Where every kind a view reads is kept from its seat, the host does not start it: it draws in its place the line a reader with no acts is given (FR-183) — the host's `signIn`, which a registered worker view now reads from the provider, as one button — or, where the host offers none, "Nothing here is shown to you." `mountWorkerView` takes `signIn` for a host that mounts one itself. The `graview-sight`, `graview-worker-view` and `graview-view-drawing` skills say the shape.

A hosted page carries 0.2 KB more up front, and one handed a compiled app 0.2 KB more, under raises of their budgets: a registered worker view reads the host's `signIn` and hands it to its host, and the store can let go of the views it kept for a seat a check made up. The guest host's chunks and every face grow, with the check as each seat, under raises of their budgets.

Tests: `a view knows what its seat cannot see`, `a view whose seat sees nothing it reads draws the way in` (guest).

Compatibility: the wire — a view's props may carry `unseen` (`kinds`, and for a worker view `fields`), only where something of what it reads is kept from its seat; nothing else a view is handed changes. Ops and primitives — unchanged. Stored formats — unchanged. The declaration and check finding codes — unchanged. Derived tool names and input schemas — unchanged.
