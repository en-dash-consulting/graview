---
id: "d292c943-1841-4fe0-8bcb-210809515fbf"
level: "feature"
title: "Money fields are said as currency on every default face"
status: "completed"
priority: "high"
startedAt: "2026-10-13T20:30:00.000Z"
completedAt: "2026-10-13T23:30:00.000Z"
endedAt: "2026-10-13T23:30:00.000Z"
lastModified: "2026-10-13T23:30:00.000Z"
resolution: "Shipped on fix/money-is-said-as-money: a number field's format (money, percent, duration, unit) is marked on its schema and said in the app's currency and the reader's locale on the record page, list rows, cards, the kind's table, the scene's record, static pages, labels, change lines and forms (\"$\" beside a box that takes \"$1,250.50\"); editDocument gains set-format and says formats in words, describeApp and tool schemas say what an amount is, and graview check warns money-currency and field-format."
tags:
  - "roadmap"
  - "0.1.29"
  - "feature:money-fields-show-as-currency-on-default-record-pages"
source: "Nick, 2026-10-14: \"i think any that can be picked up should be picked up.\""
acceptanceCriteria:
  - "A money field is said in the app's currency and locale (FR-178) on the record page, list rows, cards, tables, the kind stop, forms (input shows the currency), the scene's labels and static pages"
  - "editDocument can set and change a field's format and says it in words; a preview shows it"
  - "graview check warns when a money field has no currency to say it in"
description: "A number field marked format money shows as a bare number (10000) on the default record page, forms and tables; only {field|money} templates and lens blocks format it. add-field/retype-field accept format silently and set-field is not an edit."
---
