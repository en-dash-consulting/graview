---
id: "1e08c7c8-916a-4736-9e35-c3de11f81c55"
type: "capability"
title: "The studio changes a field in place: its type, required flag, options and description (FR-61)"
slug: "the-studio-changes-a-field-in-place"
statement: "The studio changes an existing field in place, offering acts for its type, required flag, options and description that produce the same edits as documentEdits."
criteria: [{"id":"c1","text":"The studio shall offer acts that change a field's type, required flag, options and description."},{"id":"c2","text":"When the retype act changes vendor's notes field from text to string, the act's edits() shall equal [{ op: 'retype-field', kind: 'vendor', field: 'notes', type: 'string' }]."},{"id":"c3","text":"Each field-change act shall produce the edits that documentEdits produces for that change (retype-field, set-required, set-options, set-label)."}]
tags:
  - "graview-cloud"
  - "FR-61"
source: "Graview Cloud, 2026-10-04 (brief after 0.1.4)"
priority: "medium"
---

STUDIO_MUTATIONS adds, renames and removes kinds, fields and edges, but cannot change a field, though documentEdits already turns such changes into edit ops.
