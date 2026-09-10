---
"@graview/core": patch
"@graview/layout": patch
---

An edge reads from the end you are standing on. The caption over a neighbour in the scene took the declaring side's words in both directions, so a gardener's plot was captioned "who looks after it" as though the plot looked after her; it now takes the declaration's `inverse` along an incoming edge, as the connections panel and the pages already did. `graview check` warns `edge-without-inverse` for any edge declared with one reading or none, naming what the far end would be captioned with. The scaffold, the seedbed and the launcher declare both readings.
