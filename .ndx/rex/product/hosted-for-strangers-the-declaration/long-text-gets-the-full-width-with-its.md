---
id: "d551ae94-fd08-4a24-bd4c-3a5e105b7c0f"
type: "capability"
title: "Long text gets the full width, with its label above (FR-147)"
slug: "long-text-gets-the-full-width-with-its"
statement: "A long text field on the record page takes the full width with its label above it and is edited in a multi-line textarea."
criteria: [{"id":"c1","text":"When a record page shows a long text field, the record page shall span the field across the full width with its label above, not in a narrow value column."},{"id":"c2","text":"When a person edits a long text field, the record page shall offer a multi-line textarea that keeps line breaks and grows with its content."}]
tags:
  - "graview-cloud"
  - "FR-147"
  - "design"
  - "a11y"
source: "Graview Cloud, 2026-10-08 (feedback: long text on a record page, and custom views that hide editing — Farm Bureau POM Workshop)"
priority: "high"
resolution: "Shipped in #158, merged through #162 (0.1.18): long text spans the record under its label and is changed in a text area."
---

The field table puts a 3,000-character draft in a third-width column, a tall narrow wall.
