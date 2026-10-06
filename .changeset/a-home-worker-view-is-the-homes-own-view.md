---
"@graview/guest": patch
"@graview/skills": patch
---

A worker view that attaches to the home is now the home's own view on both faces (FR-81, FR-91). `registerWorkerView` refused `attach: "home"` and sent an author to `workerHome`, which draws only on the routed face. Now it puts the view in the registry's home slot. The routed face draws it as the home's body, and the Graview face as the landing over the scene whenever the scene is at home. The home the app declared, as blocks, is what is drawn if the view fails. `workerHome` still makes a view the routed face's whole home surface. A registry with no home slot is refused as before.

Compatibility: unchanged. No op, stored format, wire message, check code or tool schema moves.
