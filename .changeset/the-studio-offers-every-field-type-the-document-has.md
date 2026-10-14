---
"@graview/studio": patch
---

The studio offers every field type the document has. Its list of field types was a copy of the document's first eleven, so another app's address (FR-171), a picture and a file (FR-162) were types a document could say and the studio could neither offer in "Add a field" nor read back: a field node of type `app-link` was refused by the studio's own schema. `FIELD_TYPES` in `@graview/studio` is now the document's own list, so a type the document gains is one the studio offers with no change here; a field declared with `appLinkField()`, `imageField()` or `fileField()` is read as `app-link`, `image` or `file`, declared back as the same helper, and written into the checkout as `appLinkField()`, `imageField()` or `fileField()`, imported from `@graview/core` beside `z`.

Compatibility: unchanged for a host. `FIELD_TYPES` in `@graview/studio` gains `image`, `file` and `app-link`, and follows the document's list from here on; the documents the studio writes back use only types the document format already has.
