---
"@graview/react": patch
---

Changing the seat is not going somewhere. A page focused on a record the new seat may not see has its stop resolved to where the app opens, and under `UrlSync` (the whole-page Shell's `syncUrl`, an embed handed the address bar) that resolution was pushed as a new history entry — so Back landed on the record's address, which the seat cannot see, which fell back again: a step that went nowhere. A change of principal now replaces the entry it resolves, and travel made afterwards still pushes. Under memory routing nothing is written, as before.

Compatibility: unchanged for stored data, ops, tool schemas and the wire. A seat change no longer adds a history entry.
