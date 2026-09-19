---
"@graview/tools": patch
---

A pair question carries the other node's id rather than parsing it out of its own key: an id may hold a colon, and the matrix run turned "practice:barrier-spraying" into an edge to a node that did not exist.
