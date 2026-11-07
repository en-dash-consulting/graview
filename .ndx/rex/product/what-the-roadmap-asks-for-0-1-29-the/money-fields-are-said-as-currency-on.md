---
id: "d292c943-1841-4fe0-8bcb-210809515fbf"
type: "capability"
title: "Money fields are said as currency on every default face"
slug: "money-fields-are-said-as-currency-on"
statement: "A number field marked as money is said as currency in the app's currency and locale on every default face of the product, not as a bare number."
criteria: [{"id":"c1","text":"When a field is marked as money, the product shall say it in the app's currency and locale (FR-178) on the record page, list rows, cards, tables, the kind stop, forms, the scene's labels and static pages."},{"id":"c2","text":"While a form shows a money field, the form input shall show the currency."},{"id":"c3","text":"When a field's format is set or changed with editDocument, editDocument shall say the change in words."},{"id":"c4","text":"When a field's format is set or changed with editDocument, the preview shall show the change."},{"id":"c5","text":"If a money field has no currency to say it in, graview check shall warn."}]
tags:
  - "roadmap"
  - "0.1.29"
  - "feature:money-fields-show-as-currency-on-default-record-pages"
source: "Nick, 2026-10-14: \"i think any that can be picked up should be picked up.\""
priority: "high"
resolution: "Shipped on fix/money-is-said-as-money: a number field's format (money, percent, duration, unit) is marked on its schema and said in the app's currency and the reader's locale on the record page, list rows, cards, the kind's table, the scene's record, static pages, labels, change lines and forms (\"$\" beside a box that takes \"$1,250.50\"); editDocument gains set-format and says formats in words, describeApp and tool schemas say what an amount is, and graview check warns money-currency and field-format."
---

A number field marked format money shows as a bare number (10000) on the default record page, forms and tables; only {field|money} templates and lens blocks format it. add-field/retype-field accept format silently and set-field is not an edit.
