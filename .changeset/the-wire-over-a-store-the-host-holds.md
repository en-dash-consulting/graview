---
"@graview/ship": patch
"@graview/core": patch
---

The wire serves a store the host already holds. `createStoreHandler` opened its own store from a `PersistenceAdapter`, so a host with its own durability — snapshots in parts, epochs, quarantine and restore, its own meter — had to give that up to get ship's wire. `createStoreHandler({ app, store, seatOf, flush?, migrated? })` now answers every `WIRE` route and `/graview/live` from the host's own `Store` instance: `flush` is awaited before a call is answered, `migrated` is said in the state, and closing the handler leaves the store open, because it is the host's. The adapter form, `createStoreHandler({ app, adapter, … })`, is now a thin layer over this one: it opens the store with `openStore` and hands it on (FR-42). `capabilities().shipped` names FR-41, FR-42 and FR-52.

Compatibility: wire unchanged — same routes, same messages, same answers. `StoreHandlerOptions` is now a union of `AdapterStoreHandlerOptions` and `HeldStoreHandlerOptions` (additive for a caller that passes an adapter). `StoreHandler.opened` is optional, because a handler over a held store has no `openStore` behind it; `createStoreHandler` with an adapter, and `serveStore`, still return it typed as present, so existing callers compile unchanged. A held store's health report says `adapter: "held by the host"`.
