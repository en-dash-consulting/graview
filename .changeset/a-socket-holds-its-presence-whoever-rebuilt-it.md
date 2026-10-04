---
"@graview/ship": patch
---

A socket holds its presence, whoever rebuilt it. A presence a socket holds is stamped `held: "socket"`, and a client keeps it for as long as the server lists it — but a host that keeps who is here itself builds the presences it hands `tell` and `receive` again from its own records, and Graview Cloud's spike dropped the stamp on the way: every client then expired the idle tabs by their `at`, and people left the room while their tabs stood open. Now the protocol stamps it. `tell(who, peers)` says `held: "socket"`, and no `until`, on every presence whose participant one of the sockets it is handed holds, whatever the host built; and `receive(peer, text, who, peers)` does the same for the presence a welcome is followed by, from the sockets the host hands it (only the receiving socket's own, unsaid). A visitor's `until` is said as the host gave it, and the host's own list is not changed. `createStoreHandler` hands `receive` its sockets.

Compatibility: additive. `LiveProtocol.receive` takes optional `peers`, the sockets the host holds. Presences a host built without `held` for a participant one of its sockets holds are now sent with `held: "socket"` and without `until`. The wire, `WIRE_PROTOCOL`, ops, stored formats and check codes are unchanged.
