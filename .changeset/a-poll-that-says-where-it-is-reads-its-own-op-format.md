---
"@graview/ship": patch
---

A poll that says where its reader is answers the ops since in the op format it reads (FR-210). `POST /graview/here` folds the ops since `seq` into the heartbeat's answer, and sent them as the store keeps them whatever the poller read, while `openRemote` said no format on that request — so a poller before op format 3 was sent splices it could not read, and one before format 2 no inverses. The handler answers them through `opsFor` with the format the request's `?opFormat=` says, as `/graview/since` does, and `openRemote` says its format there too. Ship's test holds the answer with inverses written out to a poller that says nothing and bare to one that says the current format, and `openRemote`'s heartbeat saying it and keeping a copy that matches the server's.

Compatibility: ops and primitives, stored formats, the declaration and check finding codes, derived tool names and input schemas — unchanged. The wire: `POST /graview/here` reads `?opFormat=<n>`; a request that says none is answered format 1, as every other route answers it. `capabilities().shipped` gains FR-210.
