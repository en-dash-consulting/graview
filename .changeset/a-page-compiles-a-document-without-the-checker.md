---
"@graview/core": patch
---

A page compiles a document without carrying the checker. `compileDocument` judged a document twice, by its own sentences and then by `checkApp` over the app it compiled to, and `skipFrameworkCheck: true` skipped the second at run time but not in the bundle: Graview Cloud's shell compiled in the browser a document the room had already judged and carried all of `graview check` to do it, about 42 KB minified. Now `compileDocumentWithoutCheck(raw, options)` is the same app from the same document, judged only by its own sentences, and the checker is `compileDocument`'s alone, so a page that calls only the first does not load it.

Compatibility: the declaration — a change of shape. `CompileOptions.skipFrameworkCheck` is gone: call `compileDocumentWithoutCheck(raw, options)`, a new export of `@graview/core/document`, where it was `compileDocument(raw, { skipFrameworkCheck: true })`. `compileDocument` judges exactly as before, and its findings, codes and paths are unchanged. Ops, stored formats, the wire and derived tool schemas are unchanged.
