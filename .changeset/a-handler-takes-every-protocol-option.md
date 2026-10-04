---
"@graview/ship": patch
---

A host gets every live protocol option through the handler. `liveProtocol` takes a via claim's judge, a seat key's resolver, a refusal's wording, the key withheld batches are minted under, a build per socket and the lowest host protocol, and `createStoreHandler` — and so `serveStore` — passed none of them on, so a host that wanted one gave up the handler. Each is now an option of the handler: `refusal`, `withheldKey`, `minHostProtocol`, and `build` as a string or a function of the socket (said in that socket's welcome, and on each route's answer for its asker) by the protocol's own names; and, where the handler already has a name that reads the request, the protocol's `viaOf` as `viaClaimed` and its `seatOf` as `seatOfKey`, with `seatKey(seat)`, the key a socket the handler opens keeps in its state instead of the principal. A test holds each, through the handler.

Compatibility: additive. `createStoreHandler`'s and `serveStore`'s options gain `viaClaimed`, `seatKey`, `seatOfKey`, `refusal` and `withheldKey`, and `build` may be a function; a host that gives none of them is served as before. The wire, `WIRE_PROTOCOL`, `REFUSAL_REASONS`, ops, stored formats and check codes are unchanged.
