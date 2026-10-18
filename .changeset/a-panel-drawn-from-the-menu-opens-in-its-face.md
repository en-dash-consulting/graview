---
"@graview/pages": patch
"@graview/primitives": patch
"@graview/core": patch
---

A panel drawn from the right-click menu opens in the face it was asked on (FR-184). On Pages, "Draw a panel" did nothing: the menu at the pointer was drawn outside the routed face's way of going (`GoToContext`, which Pages gives by address), so the inline AI went the scene's way, set the seat's draft with nowhere on the page to show it, and the draft waited for the scene. The routed face now gives its way of going to everything it draws, the menu and the quick ask's card included, so "Draw a panel", a panel the menu suggests and a panel or a place taken from the quick ask's card land at `/~draft` with "Keep as a lens" and "Discard", or at the place's page, and never switch face. Over the scene a drawn panel is framed on the scene's surface — the panel's color, an edge, rounded corners, a little in from the picture's edges — instead of a bare list on the ground, and the panel beside the map (a district's records, a record's links) is put away while it stands and comes back when it is kept or discarded. An ask the menu makes stays in the menu until what it asked for lands: "Asking…" while it is on its way, then the menu is put away as the ghost, the panel or the page arrives; an ask that fails is said in the menu, where the person who asked is looking, as well as in Activity, and the quick ask's card says a failed offer on the card. `capabilities().shipped` gains FR-184.

Compatibility: ops, stored formats, the wire, the declaration and derived tools are unchanged; `capabilities().shipped` lists FR-184. What Graview Cloud does: nothing — a host that mounts the pages face gets the panel at `/~draft` on the next version.
