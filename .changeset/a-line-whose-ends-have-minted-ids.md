---
"@graview/layout": patch
---

A line whose ends have minted ids can be selected. A relation in the selection is `edge:<kind>:<from>:<to>`, and the parser assumed no id would contain the separator — while `ctx.freshId(label, kind)` mints "item:buy-milk". So in every scaffolded app a clicked line was not recognised as an edge at all: the strip's title was the raw address and its body said nothing could be done with this mix of kinds. Each part is escaped now, whatever an app calls things.
