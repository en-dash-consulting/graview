---
id: "aa547494-41a5-4044-8150-4c5fe0e1e2c9"
level: "task"
title: "Relationships as structure on pages: a map of the kinds, lists that group by relation, and records that link both ways"
status: "pending"
priority: "high"
tags:
  - "pages"
  - "relations"
blockedBy:
  - "42de4f53-b0e9-44bc-a525-27f848ecadc7"
acceptanceCriteria:
  - "kindMap(store) derives kinds, edges, descriptions/inverses and live counts; unit-tested on the todo schema"
  - "Home and /map render one line per relation in the declaration's words with counts and links to both kinds and to the filtered list"
  - "A kind page states its relations as a sentence and offers group-by over its edges, in the URL"
  - "A record's relation groups link to filtered lists; the record lists the pictures it appears in with page and scene links"
  - "verify-pages.mjs checks the map, a grouped list link that reopens grouped, and a record's filtered link"
description: "A `kindMap(store)` derivation in @graview/pages: every kind, every declared edge between kinds with its description and inverse, and the live count of each — the pages-face equivalent of the scene's roads and relation key. Rendered as \"How it fits together\" on the home page and at `/map`: one line per relation in the declaration's words (\"A list holds tasks · 12\", \"A task waits for a task · 3\"), each end linking to its kind, each line linking to the list filtered by that relation. The kind page's header says its relations as a sentence (\"Tasks are held by lists, wait for tasks, and are explained by rules\") with links, and gains a group-by control over the kind's edges to other kinds (`?by=<edge>`, kept in the URL like the todo design's group), so a list of tasks can be read as lists-of-tasks-per-list. A record's relation groups link to the other kind's list filtered to this record (`/tasks?in=<id>`) and the record says which pictures it appears in (\"Seen in: The week · The month\", each a page link and a scene stop). The relation key primitive the scene draws is reused for the map's marks so the two faces share one vocabulary."
lastModified: "2026-09-21T18:10:56.419Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
