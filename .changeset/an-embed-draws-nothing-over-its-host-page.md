---
"@graview/embed": patch
---

An embed draws nothing over its host's page. Its root made no stacking context, so the scene's corner control ("Close the map") carried its own `z-index` out onto the host: on graview.dev's live demos at 768 wide the docs' sticky rail scrolled over a demo and the demo's control stood over the rail's links, so a press on "With a model" landed on the demo. The root of both the scene and the pages embed now isolates, so every layer inside it is ordered inside it, and the host's own stacking decides where the embed stands as a whole. Popovers are unchanged: they stand in the browser's top layer.

Compatibility: no surface changes.
