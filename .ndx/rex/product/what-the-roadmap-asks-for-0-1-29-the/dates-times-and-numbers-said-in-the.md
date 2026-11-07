---
id: "412ef8e3-bea4-47d0-a1fd-42cf9a3a24c3"
type: "capability"
title: "Dates, times and numbers said in the app's locale, en-US first (FR-178)"
slug: "dates-times-and-numbers-said-in-the"
statement: "The product says dates, times and numbers through Intl in the app's locale, en-US by default, on every face."
criteria: [{"id":"c1","text":"When no locale is declared, the app shall say dates, times and numbers through Intl in en-US, such as 'Sep 10, 2023', '3:30 PM' and '1,250'."},{"id":"c2","text":"The document shall declare its locale beside its currency."},{"id":"c3","text":"When a host passes the reader's locale, the app shall say dates, times and numbers in that locale."},{"id":"c4","text":"Pages, primitives, the Scene's labels, the seat's lines and the history shall each say dates, times and numbers through the app's locale."}]
tags:
  - "roadmap"
  - "f-dates-month-first"
  - "FR-178"
source: "Nick, 2026-10-13: \"do all planned items for graview core that the roadmap has laid out. capture and work them in ndx appropriately\""
priority: "high"
resolution: "Every day, time and number a face says goes through Intl in the reader's locale (a host's `locale` on the embed, provider or pages), else the app's `brand.locale`, else en-US ('Sep 10, 2023', '3:30 PM', '1,250'); describeApp, set-brand and diffDocuments say it, en-US and en-GB are pinned by tests, and capabilities().shipped gains FR-178."
---

The eighth walk found days said day first ('10 Sep 2023') in an en-US app; no Intl and no locale in core, pages or primitives. Roadmap f-dates-month-first.
