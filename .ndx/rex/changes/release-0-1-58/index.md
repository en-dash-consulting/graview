---
id: "5ac3d0cb-0196-48c0-9226-32577abed0f1"
type: "change"
title: "0.1.58: A Notion database is a connection, kept in step both ways, its tables' relations as links; Find's results stay still under the pointer and offer a record's acts when asked."
slug: "release-0-1-58"
intent: "What 0.1.58 shipped, recorded after the release from its entry in apps/site/releases.json. The work itself was tracked on the Graview Roadmap app."
acceptanceCriteria:
  - "Notion, both ways. `connections.<name>` with `\"system\": \"notion\"` keeps one Notion data source in step with one kind, through an internal integration's secret that is never written in the document, the log or an export. It speaks Notion's 2025-09-03 API: a database of several data sources names one with `source`. Title, text, number, select and status, multi-select, date, checkbox, URL, email and phone go both ways; people are read; formulas, rollups and files are left alone and said once."
  - "Relations as links. A relation property maps to an edge of the kind, to a kind another Notion connection keeps; a link made on either side arrives on the other, a page not read yet is linked once its table is, and both sides of a two-way relation settle with nothing sent."
  - "Pages land through the acts that fit. A page from Notion becomes a record through an act that makes one from its mapped fields alone, a mapped field is kept in the kind's derived edit even when another act writes it, and a page that cannot become a record is said once until it changes."
  - "Find stays still. Passing over a result only lights it; on a desk a panel beside the list shows the lit record and its acts, and on a phone a record's ⋯ opens them. Matched words are marked, each kind shows its best few with a row to all of them, and the keys are said under the list."
  - "A new project's test imports what it calls."
shippedIn: "0.1.58"
tags:
  - "backfill"
  - "0.1.58"
source: "apps/site/releases.json"
---
