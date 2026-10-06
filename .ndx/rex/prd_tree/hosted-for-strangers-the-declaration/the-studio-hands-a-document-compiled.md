---
id: "d1052c83-a06c-473d-8fb2-afa0aeae5f2b"
level: "feature"
title: "The studio hands a document-compiled app back as a document, and editDocument can set a glance (FR-54)"
status: "completed"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-54"
source: "Graview Cloud FR-54, 2026-10-03 (brief after 0.1.3)"
startedAt: "2026-10-04T11:43:14.800Z"
completedAt: "2026-10-04T11:43:14.800Z"
endedAt: "2026-10-04T11:43:14.800Z"
acceptanceCriteria:
  - "A studio opened on a document-compiled app gives back a document (studio.apply() returns document, keeping through documentOf everything the graph did not touch, or studio.edits(): EditOp[])"
  - "For Cloud's vendors fixture, adding soil: string to vendor in the studio yields a document with no error findings whose documentHash equals editDocument(d, [{ op: \"add-field\", kind: \"vendor\", field: \"soil\", type: \"string\" }])"
  - "A field type the studio cannot edit is named, not coerced"
  - "editDocument has a set-glance op"
description: "toDocument(studio.apply().app) loses acts, labels, text types, brand and description; the studio's field types lack integer, datetime, url, email, format and unit."
lastModified: "2026-10-04T11:43:14.896Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
