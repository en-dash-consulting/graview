---
"@graview/ship": patch
---

A body is held to a size before anyone is asked. `serveStore` — and so `graview serve` and `graview preview` — read every request's body into memory before it routed it, before `answer`, and before the host's `seatOf` said who was asking, and it read any size: a declared 10 GB, or a chunked body that never said how long it was, held as much of the one process every seat is served by as a stranger cared to send. Now a body is at most `maxBodyBytes` (`ServeOptions`; `MAX_BODY_BYTES`, 16 MiB — what one live message may carry — unless said). A declared length over it is answered 413 (`reason: "limit"`) before a byte is read, and a body that streams past it is answered 413 the moment it does, with the connection closed behind it; neither reaches `answer`, a route or `seatOf`. `a-body-is-held-to-a-size-before-anyone-is-asked.test.ts` holds it.

Compatibility: the wire — a request body over 16 MiB (or a host's `maxBodyBytes`) is refused 413 `limit` where it was read; nothing the framework's own clients send comes near it. Ops and primitives, stored formats, the declaration and check finding codes, derived tool names and input schemas — unchanged.
