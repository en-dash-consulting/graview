---
"@graview/core": patch
"@graview/ship": patch
"@graview/tools": patch
"@graview/primitives": patch
"@graview/skills": patch
---

An agent acts for someone, through something, and the log says so. An `Author` carries its own `name` and `onBehalfOf`, the person it acts for. An op carries `via`, what it came through: `web`, `mcp:<client>`, `view:<name>`, `api` or `cli`. The activity rail reads "Claude, for Nick, via Claude", and `nameOfAuthor` says an author's own name before any id.

An agent acting for a person may do what both may: its roles are the intersection of its own and theirs, a `self` grant is about the person, and `actingAs` gives the seat a policy judges. A `system` principal acting for nobody passes the policy and sees every record (`isSystem`), so a host's setup, seed and migrations are not refused by the app's own grants (FR-06, FR-17).

A served store believes a seat header only when told to. `serveStore({ trustSeatHeaders: true })` reads `SEAT_HEADERS`, now with kind, name and delegation, so a remote `graview mcp` is recorded as an agent. Without it and without a `seatOf`, every route but health answers 401. `graview serve` listens on 127.0.0.1 and trusts the headers there, saying so; on any other `--host` it will not start without `--trust-seat-headers`. `openRemote` sends its seat on every request, the first read included, and its calls say `via: "web"`.

Compatibility: breaking for a host that served a store without `seatOf` and relied on the seat headers: it now answers 401 until it passes `trustSeatHeaders: true`. `graview serve` binds 127.0.0.1 by default where it used to bind every interface. Additive elsewhere: `Author.name`, `Author.onBehalfOf`, `Principal.onBehalfOf`, `Operation.via` and `ApplyOptions.via` are optional fields, and ops without them read as before.
