---
id: "d292c943-1841-4fe0-8bcb-210809515fbf"
level: "feature"
title: "Money fields are said as currency on every default face"
status: "pending"
priority: "high"
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
