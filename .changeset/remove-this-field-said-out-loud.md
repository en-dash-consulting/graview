---
"@graview/core": patch
"@graview/ship": patch
---

"Remove this field" survives being written down. A patch said it by carrying the key with the value `undefined`, which JSON drops — so every persisted op that cleared a field came back with an empty half and the inverse it promised did nothing at all. Undoing a migration that added a field, after a reload, reported success and changed nothing. `UNSET` is that instruction as a value now, normalised into every operation on its way into the log, and both appliers read it.
