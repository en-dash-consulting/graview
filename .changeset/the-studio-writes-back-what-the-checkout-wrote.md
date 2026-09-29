---
"@graview/studio": patch
"@graview/skills": patch
---

The studio writes a checkout back as it found it. A field the graph still reads the same way keeps the checkout's own schema — `.max(60)`, `.int().min(1).max(99)`, `isoDate`, `nodeRef` — in the files and in the app `apply()` returns, so a round trip no longer raises `label-unbounded` or validates less than before; `z` is imported from `@graview/core`, not "zod"; and an act the checkout wrote keeps its own input, with its history sentence marked as the checkout's to supply, like its body. The `graview-studio` skill's examples address `declared:plot`, the id the studio actually uses.
