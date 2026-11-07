---
id: "e71b658f-8dbf-4c47-a332-94e3d8acdf5a"
type: "capability"
title: "Currency on any money: field as money takes currency, and an app default applies (FR-100)"
slug: "currency-on-any-money-field-as-money"
statement: "A Graview app shows money in a declared currency: a field kept as money takes a currency, and an app-level default currency applies wherever none is given."
criteria: [{"id":"c1","text":"A field declared as money shall take a currency."},{"id":"c2","text":"Where a field, figure or {x|money} template gives no currency, the app-level default currency (brand or document) shall apply."},{"id":"c3","text":"When a card shows a figure and a field of the same amount, the card shall show the same currency symbol for both."}]
tags:
  - "graview-cloud"
  - "FR-100"
  - "chat-authored"
source: "Graview Cloud, 2026-10-06 (brief after 0.1.10)"
priority: "medium"
---

On one card one amount showed '$' and the next a bare number.
