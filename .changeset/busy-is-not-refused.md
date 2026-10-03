---
"@graview/ship": patch
"@graview/core": patch
---

Busy is not refused. A host's rate limit and its message-size cap are tenancy protections, and the wire had one word for them, `refused`, on which the client takes the change back: a person lost an edit because the room was busy. `createStoreHandler`, `serveStore` and `liveProtocol` take a `limit` option, asked of every change before it is judged with the seat, the channel, its size in bytes and its calls. Answering `{ retryAfter }` is busy: the socket says `{ t: "busy", cid, retryAfter }` and `POST /graview/ops` answers 429 with `Retry-After`, nothing is judged, and `openRemote` keeps the change shown and pending and sends it again after the wait. Every later call on that socket is busy until the held one comes again, and the client's posts go one at a time, so a burst over the rate lands whole and in the order it was made, with no refusal shown. Answering `{ refuse }` is a hard cap: refused with reason `limit`, and taken back (FR-45). `capabilities().shipped` names FR-45 and FR-46.

Compatibility: wire additive — a new server message, `busy`, which a client that does not know it ignores (its call then waits until the socket is opened again); a new 429 answer from `POST /graview/ops`, given only when a host passes `limit`; `LiveSocketState` gains an optional `held`, plain JSON like the rest. A host that passes no `limit` answers exactly as before. `openRemote` now sends its posts one at a time where it sent them side by side.
