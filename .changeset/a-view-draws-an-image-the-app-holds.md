---
"@graview/guest": patch
---

A view may draw an image the app holds. Where its host says where those live (`asset` on a worker view's definition, or on `mountWorkerView`), an `img` whose `src` is the content address `add_image` answers, `/graview/assets/<sha256>.<ext>`, is drawn from the host's address for it. Nothing else under the app, and no other origin, is drawn; without `asset`, such an image is refused as before. A discography's covers and an artist's photo can now be uploaded once by address and drawn by every view, instead of carried inside the graph as `data:` text.

Compatibility: additive. A host that passes no `asset` draws exactly what it drew before.
