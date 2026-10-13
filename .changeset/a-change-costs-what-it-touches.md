---
"@graview/core": patch
---

A change costs what it touches, not what the graph holds (the ninth walk, W-197). Every change diffed the whole graph before and after, reading every field of every record through JSON — about 30 milliseconds an act on a beekeeping co-op of 8,500 records and 16,000 links, so importing 200 inspections took 9.8 seconds and `store.append` of 100 records 3.1. `Graph.applyPrimitives` now diffs only the records and links its primitives name, with the links a removed record takes, and `diffSnapshots` does not compare a record held unchanged: the 200-row import takes 240 milliseconds and the 100 appends 114.

Compatibility: the diff a change emits and returns is the same as before, in the same order; nothing stored or sent changes.
