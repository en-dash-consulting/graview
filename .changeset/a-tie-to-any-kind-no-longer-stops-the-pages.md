---
"@graview/core": patch
---

A declaration with a tie to any kind (`to: "*"`) draws its pages again. `supportingKinds`, which works out what folds into the bar's "More", read every tie's `to` as a list, and `"*".filter` threw: the pages face of homeflow, squad and proposal stopped on "(edge.to ?? []).filter is not a function" and drew nothing. Now a tie to `"*"` reaches every kind, so a note about anything is a supporting kind, as a note about two named kinds already was.

Compatibility: ops, stored formats, the wire, the declaration and derived tools are unchanged. Changed: `supportingKinds` reads a tie to `"*"` as a tie to every kind instead of throwing. What Graview Cloud does: nothing.
