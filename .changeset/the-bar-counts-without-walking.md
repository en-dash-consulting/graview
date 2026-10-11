---
"@graview/core": patch
"@graview/primitives": patch
---

The app bar says which kinds hold anything without walking every record. A kind with no records folds into "More" (`barPlaces`), and the bar asked by gathering the kind of every record in the graph each time it drew — on every page's bar, on every change. The graph now keeps how many records of each kind it holds as they come and go — added, removed, loaded, a batch that failed put back, a patch that names the kind — and `Graph.count(kind)` reads it without a walk; a seat's view of the graph (`seenBy`) counts only what that seat is served. Measured on apps/discography's 2,229 records, the bar's places took 0.044 ms a change and take 0.007; at 22,290 records, 0.42 ms and 0.009. Paid for in the same bytes: the hosted page's first load is 22 bytes lighter.

Compatibility: ops, stored formats, wire messages, the declaration, the compiled format and tool names and schemas are unchanged. New: `Graph.count(kind)`. What Graview Cloud changes: nothing.
