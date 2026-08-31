---
"@graview/layout": patch
"@graview/react": patch
---

A relation between two members of the same kind is drawn as a loop in the
Graview rather than dropped. The legend was counting `waits-for 3` while the
picture drew nothing.
