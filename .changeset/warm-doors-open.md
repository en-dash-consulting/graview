---
"@graview/core": patch
"@graview/primitives": patch
"@graview/react": patch
---

A declaration can now say how its fields read — hide an ordering key, label a
field, format a stored value — and an edge can carry an `inverse` so it reads
correctly from both ends. Booleans render as words. Chips ellipsise (the
`text-overflow` never applied, being on a flex container). And `Backtrack`
makes the browser's own back and forward visible, because an interface whose
navigation is the browser's should not require knowing that.
