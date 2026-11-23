---
"@graview/core": patch
"@graview/primitives": patch
"@graview/guest": patch
"@graview/skills": patch
---

A file value may carry a preview its host made, and a record is drawn by it. A workshop's deliverables are PDFs: a card and a row showed nothing of them, a view needed a preview field kept by hand that went stale when a file was replaced, and declaring `pictures` on that view took the `href` from the PDFs themselves. A stored `FileValue` may now say `preview: { src, thumb?, width?, height? }` — `src` a picture of the document (a PDF's first page), `thumb` a smaller one, each a path on the host as `href` is, and `src`'s size in pixels (`FilePreview`, `isFilePreview`, `previewOf` and `isPictured` on `@graview/core`; the file field's schema refuses a preview that is no path on the host).

- A card and a row draw a record by the preview's `thumb` (else its `src`) where it holds no picture or video of its own (`firstPicture`), and an `image` block's thumb takes it too.
- A record's page draws the preview where a PDF's box stood, pressed to open the document in a tab, its line of name, type, size, Open and Download under it.
- A worker view or a frame that asks for `pictures` is handed a document with a preview as a picture is: `src` and `thumb` made from the preview's bytes, fetched as the reader where the host serves it, with `width`, `height`, `aspect` and `left`, under the view's budget and its choice of kinds, fields and records.
- Asking for pictures takes nothing from a document: a file that is neither an image nor a video is handed as the record keeps it, `href` included, where it was its name, type and size alone, so a view can still hand it to an act. A picture and a video are handed as before; a preview's own paths stay the host's.
- The document schema says a stored file whole as `$defs.FileValue`, each key described, and a field's `type` says what an `image`, `video` or `file` field holds. The `graview-view-drawing` and `graview-ship` skills say what a preview is.

Held by unit tests of the pages (`a-document-with-a-preview-is-drawn-by-its-picture`) and the guest (`a-views-pictures-resolve-a-files-preview`).

Compatibility: Stored formats — additive: a file value may keep `preview`, and one without it is read as before; one whose preview is out of shape is refused, as a malformed `width` is. The wire — a document handed to a view that asks for `pictures` now carries the record's `href`, `at` and the rest of its value beside its name, type and size, and one with a preview carries `src`, `thumb`, `width`, `height` and `aspect`; a view that reads none of them is drawn as before. Derived tool names and input schemas — a file field's input takes the optional `preview`; nothing is renamed or required. Ops and primitives, and the declaration and check finding codes — unchanged. What Graview Cloud does: to have a document drawn by its first page, set `preview` on the file value it stores (and make it again when the file is replaced).
