---
id: "eabef11f-da04-424f-8b7d-84c80c65c592"
type: "capability"
title: "Cards you can read at a glance"
slug: "cards-you-can-read-at-a-glance"
statement: "Cards in Graview lists are readable at a glance: long text is clamped, summaries can be excerpted, lists never become their own scroll area, and cards keep their own height in a grid row."
criteria: [{"id":"c1","text":"When a card shows a long text field, the card shall clamp it to about 3 lines, and a row shall clamp it to 1, while the record's page shows it whole."},{"id":"c2","text":"When a template uses {summary|excerpt}, the template engine shall render the first sentence or about 140 characters of the field, and {summary|excerpt: 80} shall limit the excerpt to 80 characters."},{"id":"c3","text":"A list of cards shall not become its own scroll area, and when a long list is cut with limit, the list shall show a 'See all N' link."},{"id":"c4","text":"While cards sit in one grid row, each card shall keep its own height instead of stretching to the tallest card."},{"id":"c5","text":"When a card or row puts a text field whole in a text block, graview check shall warn and name {summary|excerpt}."}]
tags:
  - "roadmap"
  - "f-glanceable-cards"
source: "Nick, 2026-10-13: \"do all planned items for graview core that the roadmap has laid out. capture and work them in ndx appropriately\""
priority: "high"
resolution: "Card text clamps to three lines and row text to one (the page says it whole), `{summary|excerpt}` and `{summary|excerpt: 80}` say a long text's start, cards in a row keep their own heights, a blocks place flows with the page and a list cut by its limit says \"See all N\", and `graview check` warns `view-whole-text`. Proved by `pnpm verify growing` at desk and phone in three engines."
---

On the Roadmap's Up next, each card printed its whole 30-line summary, so a row of cards was a wall of text in an inner scroll box. Roadmap f-glanceable-cards.
