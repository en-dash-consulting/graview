---
id: "9ef5bac2-c92c-4e22-9235-b33efb45b0e8"
type: "change"
title: "Text keeps its line breaks everywhere it is drawn (FR-146)"
slug: "text-keeps-its-line-breaks-everywhere"
intent: "A 3,000-character email draft with paragraphs and lists is drawn as one block on the record page and in { text: '{draft}' } blocks."
acceptanceCriteria:
  - "A text field's \\n and \\n\\n survive in the field table, text blocks and templates"
  - "Light structure: a blank line is a paragraph, lines starting '1.' or '-' are lists, drawn as real paragraphs and lists from text alone"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-146"
  - "bug"
  - "words"
source: "Graview Cloud, 2026-10-08 (feedback: long text on a record page, and custom views that hide editing — Farm Bureau POM Workshop)"
resolution: "Shipped in #158, merged through #162 (0.1.18): a record's prose keeps its paragraphs everywhere it is drawn; pnpm verify long-text holds it."
---

Migration suggestion (text claude-sonnet-5-5, not accepted): place on "A record page's blocks get a page's budget by default" (da9b5d63-6fa2-4227-a67e-d717b04c27f3).
