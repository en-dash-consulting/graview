---
id: "e3a2f901-1212-4a99-9664-4c09daa34e52"
type: "capability"
title: "Markdown in a text field, and every list says a text field as an excerpt (FR-180)"
slug: "markdown-in-a-text-field-and-every"
statement: "A text field in a Graview app can be declared as Markdown, which the record page renders as sanitized prose, and every list, card, row, describe line and kind stop says any text field as a short plain excerpt."
criteria: [{"id":"c1","text":"When a text field says format \"markdown\", the record page shall render it as sanitized prose with headings, lists, emphasis, links and code."},{"id":"c2","text":"The record page shall not render raw HTML or scripts from a Markdown text field."},{"id":"c3","text":"The record page shall give every link in a rendered Markdown text field rel noopener."},{"id":"c4","text":"Lists, cards, rows, describe lines and the kind stop shall say any text field as an excerpt of its first line or about 160 characters, with an ellipsis after and Markdown syntax stripped."},{"id":"c5","text":"The record page shall keep the newlines of a plain text field."},{"id":"c6","text":"The form shall offer a textarea for a text field."},{"id":"c7","text":"editDocument, the checker, the schema and the studio shall know the Markdown format of a text field."},{"id":"c8","text":"capabilities().shipped shall name FR-180."}]
tags:
  - "roadmap"
  - "0.1.29"
  - "f-markdown-text"
  - "FR-180"
source: "Graview Cloud, Framework brief after 0.1.28 (2026-10-13): FR-180, asked ahead of the rest of the pages pass"
priority: "critical"
resolution: "Shipped on feat/fr-180-markdown-text: `format: \"markdown\"` on a text field (`markdownField()` in TypeScript) through schema, checker (`field-format`), compile, editDocument (`retype-field`), diff, the studio and the tool schema (`contentMediaType: text/markdown`); the record page, the scene's record and static pages draw it as sanitized prose with `@graview/core/markdown` (no HTML, links http/https/mailto only, pictures as words), fetched lazily; rows, cards, describe lines, table cells, search hits and seat lines say any text field through `excerptOf`, syntax stripped. long-text harness claims hold in three engines and both schemes; capabilities().shipped names FR-180."
---

The Roadmap app's briefs are Markdown in a text field; the Briefs list draws each body whole with the syntax showing, and the record page too. Roadmap f-markdown-text; Cloud's half f-markdown-text-cloud.
