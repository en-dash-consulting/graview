---
id: "9630706d-e996-42a2-ad0e-46900e005daa"
type: "change"
title: "0.1.61: A host's buttons stand on the app bar, a choice takes several of its options, a weekly record is one recurring event, a connection refused says its ways out, and a compaction can be asked to stay readable by an older build."
slug: "release-0-1-61"
intent: "What 0.1.61 shipped, recorded after the release from its entry in apps/site/releases.json. The work itself was tracked on the Graview Roadmap app."
acceptanceCriteria:
  - "A compaction asked for format 1. 0.1.60's `pins: [store.publishedSeq]` held a store at snapshot format 1 only when the horizon landed on that one publish; `compact({ format: 1 })` now holds it there through every publish while a rollback is possible, and `formatStamp` stamps 2 for any checkpoint carrying a publish."
  - "A host's buttons on the app bar. `barActions` on `mount`, the frame, the pages embed and the Shell, drawn on the bar or folded into one control on a phone; `setBarActions` changes them live."
  - "A choice takes several of its options. `{ \"type\": \"enum\", \"multiple\": true }`: boxes in forms, labels on cards and sheets, a filter in lists, Notion's multi-select, an array in every schema, `set-multiple` in the studio."
  - "Connections. A calendar connection refused says why in a person's words and carries `fixes` with edits a host can apply (`set-connection`); a kind with `days` and times of day is one recurring Google event, and a repeating date maps to its RRULE."
  - "The Scene and the panels. The ground answers a right-click and a resting finger with Graview's menu; a cut card says More at its foot; Activity never scrolls sideways; a suggestion's record chips open their record; a link is offered on evidence, not one common word; a PDF that cannot be shown is one line."
  - "Agents and the starter. `graview check` warns when a face reads content beside the graph; `traitsOf`, `startingDocument`, `nounWords` and `pluralWords` on `/compose`, and `@graview/tools/starter` asks the starter's questions with the host's model."
shippedIn: "0.1.61"
tags:
  - "backfill"
  - "0.1.61"
source: "apps/site/releases.json"
---
