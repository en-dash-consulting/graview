---
id: "eabef11f-da04-424f-8b7d-84c80c65c592"
level: "feature"
title: "Cards you can read at a glance"
status: "completed"
priority: "high"
tags:
  - "roadmap"
  - "f-glanceable-cards"
source: "Nick, 2026-10-13: \"do all planned items for graview core that the roadmap has laid out. capture and work them in ndx appropriately\""
startedAt: "2026-10-13T02:45:00.000Z"
completedAt: "2026-10-13T04:30:00.000Z"
endedAt: "2026-10-13T04:30:00.000Z"
acceptanceCriteria:
  - "A long text field on a card is clamped to about 3 lines, on a row to 1; the record's page shows it whole"
  - "A template filter {summary|excerpt} (first sentence or ~140 characters) and {summary|excerpt: 80}"
  - "A list of cards never becomes its own scroll area; a long list is cut with limit and a 'See all N' link"
  - "Cards in one grid row don't stretch to the tallest"
  - "graview check warns when a card or row puts a text field whole in a text block, naming {summary|excerpt}"
description: "On the Roadmap's Up next, each card printed its whole 30-line summary, so a row of cards was a wall of text in an inner scroll box. Roadmap f-glanceable-cards."
lastModified: "2026-10-13T04:30:00.000Z"
resolution: "Card text clamps to three lines and row text to one (the page says it whole), `{summary|excerpt}` and `{summary|excerpt: 80}` say a long text's start, cards in a row keep their own heights, a blocks place flows with the page and a list cut by its limit says \"See all N\", and `graview check` warns `view-whole-text`. Proved by `pnpm verify growing` at desk and phone in three engines."
---
