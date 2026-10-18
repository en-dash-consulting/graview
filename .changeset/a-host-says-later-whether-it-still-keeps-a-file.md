---
"@graview/core": patch
"@graview/primitives": patch
---

A host may say later whether it still keeps a file (the Roadmap's f-files-kept-async). `HostFiles.kept(href)` answered only at once, so a host whose bytes are elsewhere — Graview Cloud's are in R2 — passed none, and every picture a record held in the past was drawn as kept while somebody scrubbed back, though the host had let it go. `kept` may now answer `boolean | Promise<boolean>`: the picture is drawn as itself until the promise settles and as "removed later" if it settles to `false`, on a card's thumbnail, an `image` block and a record's gallery alike. The page asks once per href for as long as it holds that `files`, so a scrub, a second card or the record's page reads the answer already given rather than asking again, and a promise that rejects is taken as kept rather than thrown. A synchronous `kept` is asked as before, every time a picture is drawn.

Compatibility: ops, stored formats, the wire, the declaration and derived tools are unchanged; a host's `kept` that answers a boolean works as it did.
