---
"@graview/core": patch
"@graview/ship": patch
---

Stored formats carry their version. Core declares `FORMATS` (snapshot 1, op 1) and stamps what it writes with `formatStamp()`: the framework version and each format. `upgradeSnapshot` and `upgradeOp` bring an older format up one step at a time, and `assertReadable` throws `NewerFormatError` for a format this build does not know.

A store's meta and every exported bundle now record `{ framework, formats }`. `openStore` refuses a snapshot whose meta says a newer format, so a rolled-back framework does not fold what its successor wrote and write its misreading back; the host refolds from the log or rolls forward. `assertBundle` checks the same. Everything written before the stamp reads as format 1, and a fixture of it is held by a test (FR-31).

Compatibility: stored format — snapshot 1 and op 1, unchanged. Store meta and bundles gain `framework` and `formats` (additive; an unstamped one reads as format 1). A meta or bundle stamped with a newer format is now refused with `NewerFormatError` where it used to be read as if it were current.
