---
"@graview/core": patch
"@graview/ship": patch
---

Modules reach the host. `enabledModules` was a store option nothing passed, so a host binding a workspace's modules to what it pays for had nowhere to say so, and a served store sent every record of a module the workspace did not have. `openStore`, `createStoreHandler` and `serveStore` now take `enabledModules`, and `openRemote` takes it for a server that does not say. `GET /graview/state` and the live wire's `welcome` say which modules are on in `enabledModules`.

Turning a module off or on is an op. `store.setEnabledModules(enabled)` appends one op authored `system · modules` (`MODULES_AUTHOR`), with a sentence ("Turn off Vehicles") and the set it leaves in `Operation.enabledModules`. It touches no record, so it folds to nothing, and turning the module on again brings every record back as it was. `store.modules` is now read from the log: the set the last such op says, or the one the store was opened with. `openStore` writes the op when the host's set differs from the log's, and only then. `checkUndo` refuses to take one back, because the set changes by turning the module the other way.

A module off is off on every route and tool. Its acts were already refused. A call that names one of its records is now refused too, whoever makes it. Its kinds are kept from every seat but the system, the way a sight keeps a record: `seenBy` leaves them out of the graph, its ops are withheld in place on `/graview/state`, `/graview/since`, `/graview/export` and the live wire, and the agent tools read through the same view. `hidesFrom(store, principal)` says whether anything is kept from a seat (FR-12).

Compatibility: additive for ops: `Operation.enabledModules` is a new optional field, an op without it reads and folds as before, and no fixture differs. Additive for the wire: `enabledModules` is a new response field on `GET /graview/state` and the `welcome` state, and the options are new. Changed for `seenBy(store, principal)` on a store with a module off: it is now a view without that module's kinds, where it used to be the store itself. `Store.modules` is a getter rather than a field fixed at construction. Stored formats and derived tool schemas are unchanged.
