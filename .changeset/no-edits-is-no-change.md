---
"@graview/core": patch
"@graview/studio": patch
---

No edits is no change. A surface that says its changes as edits has none when nothing changed — the studio's `edits()` is `[]` on a studio nobody touched — and `editDocument(d, [])` refused it ("give at least one edit"), so every host had to treat nothing as a special case. An empty list now hands back the document as it was, with no sentences and no fills. `edits` that is not a list at all is still refused, in words. The studio's `document()` no longer needs its own case for it.

Compatibility: the document edit vocabulary — `editDocument` with an empty list now answers `{ ok: true, document, said: [], fills: [] }` where it answered `{ ok: false }` with an `edit` finding at `edits`; a caller that counted on the refusal to mean "nothing to do" gets the same document back instead. Every non-empty list applies as before. The op set, the document format, ops, stored formats, the wire, tool names and schemas, and check codes are unchanged.
