---
id: "d1052c83-a06c-473d-8fb2-afa0aeae5f2b"
type: "capability"
title: "The studio hands a document-compiled app back as a document, and editDocument can set a glance (FR-54)"
slug: "the-studio-hands-a-document-compiled"
statement: "The studio hands a document-compiled app back as a document, and editDocument can set a glance."
criteria: [{"id":"c1","text":"When a studio is opened on a document-compiled app, the studio shall give back a document, either through studio.apply() returning a document that keeps through documentOf everything the graph did not touch, or through studio.edits() returning an EditOp[]."},{"id":"c2","text":"When soil: string is added to vendor in the studio for Cloud's vendors fixture, the studio shall yield a document with no error findings whose documentHash equals that of editDocument(d, [{ op: \"add-field\", kind: \"vendor\", field: \"soil\", type: \"string\" }])."},{"id":"c3","text":"If a field type cannot be edited in the studio, the studio shall name that field type rather than coerce it."},{"id":"c4","text":"editDocument shall accept a set-glance op."}]
tags:
  - "graview-cloud"
  - "FR-54"
source: "Graview Cloud FR-54, 2026-10-03 (brief after 0.1.3)"
priority: "high"
---

toDocument(studio.apply().app) loses acts, labels, text types, brand and description; the studio's field types lack integer, datetime, url, email, format and unit.
