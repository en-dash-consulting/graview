---
"@graview/core": patch
---

A stability contract a host can hold the framework to. `docs/stability.md` says what a version may change on each of five surfaces: ops and primitives, stored formats, the wire, the declaration and its check codes, and derived tool names and schemas. A pull request that touches one of them needs a `Compatibility:` line in every changeset it adds, and CI refuses one without it. `capabilities()` returns `{ version, protocol, documentFormats, formats, shipped }`, with `shipped` naming the FR ids of the seams this version ships, and `WIRE_PROTOCOL` numbers the wire (FR-30).

Compatibility: additive — `capabilities()`, `Capabilities` and `WIRE_PROTOCOL` are new; the wire is protocol 1, as it has always been.
