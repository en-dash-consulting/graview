---
id: "e3a2f901-1212-4a99-9664-4c09daa34e52"
level: "feature"
title: "Markdown in a text field, and every list says a text field as an excerpt (FR-180)"
status: "completed"
priority: "critical"
tags:
  - "roadmap"
  - "0.1.29"
  - "f-markdown-text"
  - "FR-180"
startedAt: "2026-10-14T01:05:00.000Z"
completedAt: "2026-10-14T05:40:00.000Z"
source: "Graview Cloud, Framework brief after 0.1.28 (2026-10-13): FR-180, asked ahead of the rest of the pages pass"
acceptanceCriteria:
  - "A text field may say format: \"markdown\"; the record page renders it as sanitized prose (headings, lists, emphasis, links, code; no raw HTML, no scripts, links rel noopener)"
  - "Lists, cards, rows, describe lines and the kind stop say any text field as an excerpt: its first line or about 160 characters, an ellipsis after, Markdown syntax stripped"
  - "Newlines are kept on the record page for plain text fields"
  - "The form is a textarea for a text field; editDocument, the checker, the schema and the studio know the format"
  - "capabilities().shipped names FR-180; a changeset with a Compatibility line"
resolution: "Shipped on feat/fr-180-markdown-text: `format: \"markdown\"` on a text field (`markdownField()` in TypeScript) through schema, checker (`field-format`), compile, editDocument (`retype-field`), diff, the studio and the tool schema (`contentMediaType: text/markdown`); the record page, the scene's record and static pages draw it as sanitized prose with `@graview/core/markdown` (no HTML, links http/https/mailto only, pictures as words), fetched lazily; rows, cards, describe lines, table cells, search hits and seat lines say any text field through `excerptOf`, syntax stripped. long-text harness claims hold in three engines and both schemes; capabilities().shipped names FR-180."
description: "The Roadmap app's briefs are Markdown in a text field; the Briefs list draws each body whole with the syntax showing, and the record page too. Roadmap f-markdown-text; Cloud's half f-markdown-text-cloud."
---
