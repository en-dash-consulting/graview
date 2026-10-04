---
"@graview/ship": patch
---

The declaration's number is said to be the host's. `liveProtocol({ version })` was documented as "the declaration's version, said in a welcome's state", and Graview Cloud's spike passed its own document version there rather than the document's — rightly, but the docs did not say so. Now `LiveProtocolOptions.version`, the ship README and docs/stability.md say what it is: the host's own monotonic number for the declaration it serves — `app.version`, or a host's document version — said in every welcome, every route's answer and the `declaration` push, and handed by a client to `resolveApp(version)`; a push with the number a client already serves is ignored, and a test now holds that. docs/stability.md also says the client's batch shape, the opaque batch of a withheld op, the `via` claim and the host protocol, and every option this release added to `liveProtocol`, `createStoreHandler` and `openRemote` is in the README.

Compatibility: documentation and a test only. Nothing a program can observe changes.
