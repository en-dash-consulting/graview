---
"@graview/ship": patch
---

The dev server's files door (`devFiles`, `@graview/ship/dev`) serves everything but a PDF with `Content-Security-Policy: sandbox`, so an SVG, which its default `image/*` takes and which can carry a script, still draws in an `<img>` and runs nothing as the app's page when it is opened on its own or in the record page's document frame. `docs/stability.md` and the `graview-ship` skill now say what a host's own files route does for the same reason: the type its bytes are, `nosniff`, the sandbox on all but a PDF, a download for anything not shown, and each file only to a seat that sees a record holding it.

Compatibility: unchanged.
