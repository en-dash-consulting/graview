---
"@graview/ship": patch
---

A view's channel reaches the wire as a claim. A guest view applies as the viewer with `via: "view:<name>"`, so the activity rail can say where an act came from; on a remote store that claim stopped in the browser, because `openRemote`'s `applyAll` and `undo` sent no `via` and the server could not even be asked to believe it. Now a call or an undo made with a `via` carries it — as `via` on the socket's `call` and `undo`, and in the body of `POST /graview/ops` — and keeps it when it is offered again after a new declaration or a reload, or sent again by `useMine`. What the server makes of it is the server's (FR-52): by default it records its own channel and ignores the claim; a host that accepts one says so through its own `viaOf`.

Compatibility: the live wire — additive: `LiveClientMessage`'s `call` and `undo` gain optional `via`, and the `POST /graview/ops` body may carry `via`. A server that does not read it ignores it, as it ignores any field it does not know; `WIRE_PROTOCOL` is unchanged. What an op records as its `via` is unchanged. Ops, presence, stored formats and check codes are unchanged.
