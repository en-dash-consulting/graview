---
"@graview/ship": patch
---

A view's channel claim survives the ways a call is sent again. `openRemote` sends the `via` a call or an undo was applied with — a guest view's `view:<name>` — as a claim the host's `viaOf` may accept (FR-52); a call offered again on a new declaration (FR-43) or after a reload (FR-44), or sent again by a conflict's `useMine`, went without it, so the same press could arrive once as the view's and once as nobody's. Now each keeps the claim it was made with. A test holds the claim on the socket and over HTTP, for a call and an undo, and that a host that accepts no claim still records its own channel.

Compatibility: the live wire — unchanged: the claim rides the `via` field `call`, `undo` and the `POST /graview/ops` body already carry. What the `carry` storage holds across a reload gains an optional `via` per call; one written before it is read as before. Ops, presence, stored formats and check codes are unchanged.
