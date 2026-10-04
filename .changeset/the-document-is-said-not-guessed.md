---
"@graview/studio": patch
"@graview/skills": patch
---

A host says the document the studio opens on, rather than the studio guessing it from an object's identity. The studio found the document an app was compiled from by the very object `compileDocument` returned, so `createStudio({ ...compiled.app })`, or an app with its policy swapped for the signed-in seat's, gave `document()` undefined — silently: the host got a TypeScript app back and no word of why. `createStudio(app, { document })` now says the document outright, and a copy or a seat's app with it said hands back the document as the compiled app does (the document's own policy kept). When the studio knows no document, `document()` is still undefined and `studio.whyNoDocument()` says why in one finding (`studio-no-document`, with `createStudio(app, { document })` as the fix); `apply()` hands that finding back as `documentFindings`. The graview-studio skill says how, and that the studio judges a document by compiling it.

Compatibility: additive. `StudioOptions` gains `document`; `Studio` gains `whyNoDocument()`. `apply()` on a studio that knows no document — a TypeScript app's — now carries `documentFindings: [studio-no-document]` where it carried none; `studio-no-document` is a new finding code only the studio produces, a warning. The document format, the edit op surface, ops, stored formats, the wire and check codes are unchanged.
