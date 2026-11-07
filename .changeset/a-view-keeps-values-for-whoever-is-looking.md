---
"@graview/core": patch
"@graview/guest": patch
"@graview/react": patch
"@graview/primitives": patch
"@graview/pages": patch
"@graview/embed": patch
"@graview/ship": patch
"@graview/tools": patch
"@graview/skills": patch
---

A worker view keeps small values for whoever is looking at it, and one sign-in can be several people at one screen (Roadmap f-viewer-state-and-me-framework). Children on one shared tablet need their own progress in a family's app, and each visitor to a demo their own, and until now an app held only records, shared by everyone who may see them, and a reader's settings.

`graview.mine.get(key)` answers a string or `null`, `graview.mine.set(key, value | null)` keeps a string of at most 4 KB or forgets it, and `props.mine` holds them at draw time, so a first draw needs no round trip. A value past 4 KB, or one a host will not keep, rejects with a sentence, which `onProblem` hears too, never quoting the value. They go to a host's `ViewerState` — `{ read(view), write(view, key, value) }`, answering `{ ok: true }` or `{ ok: false, sentence }`, handed to `mount`, `<Embed>`, `PagesApp`, `<Shell>` and `GraviewProvider` as `viewerState`, and to `mountWorkerView` — and without one they last the visit, in the page's memory, per view and per viewer. A view asks by key alone and the host says its name, so another view's values are not reachable. They are not the graph's: no op, no history, no undo, no export, no agent's tool, and a headless run is handed none. A draft keeps nothing of anybody's.

A seat may carry `profile: { id, name }`. `$me`, a view's new `props.me`, and a sight `via` the people or `own` then read that profile's person: a record of the people kind, made by the first act in that act's own batch (a refused act makes none, and undoing the act leaves it), with the id `<account>~<profile id>`, so it is linked to the account by what it is called and no profile can name a member's record or another account's. What the seat may do stays the account's: its roles and grants are read as they were, and `self` and `ownEnd` read both the account's record and the profile's person as its own. History and presence say "Mia (Nick)". Without a profile nothing changes, except that a view whose seat has a person record in its sight is now told so in `props.me`. A served store reads a profile from `x-graview-profile` and `x-graview-profile-name` exactly when it believes the seat's headers, and otherwise from its host's `seatOf`.

`a-view-keeps-its-own-values-for-whoever-is-looking.test.ts`, `a-profile-is-a-person-under-one-account.test.ts`, `a-served-store-carries-a-profile-as-it-carries-the-seat.test.ts` and `a-profiles-first-act-lands-the-same-on-the-page-and-the-server.test.ts` hold it; `guest-sandbox`'s new `mine` transport and `verify-who` drive it in a real browser ("a view's first draw has what it keeps, from one read of its own name and no ask of its own"; aProfileIsNamedToTheRoomAsThePersonAtTheScreenAndTheirAccount).

A hosted page carries 1.8 KB more up front, and one handed a compiled app 1.6 KB.

Compatibility: ops and primitives — an op's author may carry an optional `profile`, which a build before this one keeps and ignores, and the first act of a seat with a profile adds one op, with no act, that makes its person. Stored formats — unchanged. The wire — new: the guest protocol's `mine` request and `mine-answer`, a frame's host dropping the request unread, `GuestProps.mine` and `GuestProps.me`, and the seat headers `x-graview-profile`, `x-graview-profile-name`, `x-graview-for-profile` and `x-graview-for-profile-name`. The declaration and check finding codes — unchanged. Derived tool names and input schemas — unchanged. The JavaScript API — new, optional: `ViewerState`, `viewerState`, `SeatProfile`, `Author.profile`, `meOf`, `profileOf`, `profilePersonId`, `graview.mine`.

What Graview Cloud does: implement `ViewerState` over `viewer_state` and `/graview/mine` and hand it to the mount as `viewerState`, bound to the seat's viewer id, with its caps said as sentences; say `profile: { id, name }` on the principal `seatOf` returns (and on the client's `principal`), and key a socket's seat by it (`seatKey`); expect a profile's person at `user:<account>~<prf_id>`, and rename or retire it with the member's own (`people.ts`) if a profile's name changes, since the framework only makes it.
