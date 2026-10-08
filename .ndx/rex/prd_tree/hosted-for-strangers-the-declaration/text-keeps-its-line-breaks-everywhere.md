---
id: "9ef5bac2-c92c-4e22-9235-b33efb45b0e8"
level: "feature"
title: "Text keeps its line breaks everywhere it is drawn (FR-146)"
status: "pending"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-146"
  - "bug"
  - "words"
source: "Graview Cloud, 2026-10-08 (feedback: long text on a record page, and custom views that hide editing — Farm Bureau POM Workshop)"
acceptanceCriteria:
  - "A text field's \\n and \\n\\n survive in the field table, text blocks and templates"
  - "Light structure: a blank line is a paragraph, lines starting '1.' or '-' are lists, drawn as real paragraphs and lists from text alone"
description: "A 3,000-character email draft with paragraphs and lists is drawn as one block on the record page and in { text: '{draft}' } blocks."
lastModified: "2026-10-08T19:43:15.454Z"
---
