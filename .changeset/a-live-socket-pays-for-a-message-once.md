---
"@graview/ship": patch
---

A live socket pays for a message once. The live wire's server half (`acceptSocket`, behind `graview serve` and `serveStore`) capped a message at 16 MiB and nothing else: each fragment summed every fragment before it, a zero-length continuation added a fragment without adding a byte, and a continuation was taken with no message begun, so 32,000 empty continuations (192 KB) held the one event loop every seat is served on for most of a second. And every chunk of a frame still arriving was copied onto everything before it, so a 4 MiB frame sent in 1 KiB chunks cost 0.7 s of copying where 64 KiB chunks cost 20 ms. Now a message keeps a running total and a count: more than 1,024 fragments closes the socket with 1008, a continuation with no message begun or a new message inside one closes it with 1002, and over 16 MiB still closes it with 1009. Chunks wait in a list and are joined once the frame they belong to has all arrived. `a-socket-pays-for-a-message-once.test.ts` holds it.

Compatibility: ops and primitives and the wire — unchanged for any client that speaks RFC 6455: a browser and Node's `WebSocket` never send a message in more than a handful of fragments, nor a continuation outside one. Stored formats, the declaration and check finding codes, derived tool names and input schemas — unchanged.
