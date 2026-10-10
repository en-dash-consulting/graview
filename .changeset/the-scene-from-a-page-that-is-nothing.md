---
"@graview/embed": patch
"@graview/core": patch
---

The scene from a page that is nothing lands where the scene opens (FR-157). Graview Cloud, on the Pages face at an address no route answers ("Nothing lives at this address."): the bar's Scene control landed the scene at `/places/overview#`, the empty view, the overview off, the control saying Up, over nothing. The pages leave the scene's view holding nothing when no page named a place in it, and the switch drew exactly that. Now, when the view the switch would take holds nothing (no focus, not at altitude), it lands where the scene opens: where the declaration says the app opens (`pages.first`, FR-80), else at altitude, on the Graview's face. Under address routing the address pushed is that stop, a step Back undoes as before; under memory routing the scene's view moves there when the face comes back from the pages. A list page holds nothing in the scene either, so the switch from one now lands the same way, where it drew the empty view. A view that holds a focus or is at altitude is taken as it was. `capabilities().shipped` gains FR-157.

Compatibility: ops, stored formats, wire messages, the document format, the compiled format, check finding codes and tool schemas are unchanged; `capabilities().shipped` gains FR-157. Changed: the face and the stop the switch's Scene lands on from a page that held nothing in the scene, which a host told by `onFace` now hears as `"graview"` when the app names no first place.
