---
"@graview/guest": patch
"@graview/core": patch
---

A frame guest may read across kinds, and may be the home (FR-85). A guest in a frame was handed only the records it was drawn over and the edges among them, so a view of packages could not show what each package includes. `guestView` and `mountGuestView` now take `reads: { kinds, edges }`, as a worker view's manifest does (FR-91): the guest is also handed every record of the kinds it reads and every edge of the edges it reads between the records it holds, as the viewer sees them. One rule now serves both, `readAcross` in `@graview/guest/host`, and `workerViewProps` reads through it too. A guest over packages that reads `offer` and `includes` gets each package's offers; an offer the viewer may not see is in none of it, as a node, an edge, a label or a figure. Drawn as the home (`views.home(guestView(…))`), a guest is drawn over nothing and sees what it reads: it is the routed home's body. Every record's `label` is filled as the host labels it, as it has been since FR-91. A unit test pushes Lin's frame over the offers fixture's packages, with and without `reads`, and finds the offers she may see and none she may not; Erin's holds the margin review; a frame drawn over nothing holds what it reads; and the routed home draws a home-attached frame as its body.

Compatibility: unchanged. A guest that reads nothing is handed what it was before. The wire: `capabilities().shipped` gains `FR-85`. Ops, stored formats, check codes and tool schemas are unchanged.
