---
id: "412ef8e3-bea4-47d0-a1fd-42cf9a3a24c3"
level: "feature"
title: "Dates, times and numbers said in the app's locale, en-US first (FR-178)"
status: "pending"
priority: "high"
tags:
  - "roadmap"
  - "f-dates-month-first"
  - "FR-178"
source: "Nick, 2026-10-13: \"do all planned items for graview core that the roadmap has laid out. capture and work them in ndx appropriately\""
acceptanceCriteria:
  - "Dates, times and numbers are said through Intl with the app's locale, en-US by default: 'Sep 10, 2023', '3:30 PM', '1,250'"
  - "The document can say its locale beside its currency; a host can pass the reader's"
  - "Every face (Pages, primitives, the Scene's labels, the seat's lines, the history) uses it; tests pin the en-US words"
  - "Not asked: translating the framework's own words"
  - "A changeset with a Compatibility line names FR-178"
description: "The eighth walk found days said day first ('10 Sep 2023') in an en-US app; no Intl and no locale in core, pages or primitives. Roadmap f-dates-month-first."
---
