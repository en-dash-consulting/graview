---
id: "b5c001b9-6f4e-47e8-b46c-d73d3e18278b"
level: "task"
title: "The relation band draws what fits and groups the rest: a derived budget, grouping by the declaration, aggregates that open"
status: "completed"
priority: "critical"
blockedBy:
  - "13abb271-4d49-4e1c-8a8c-407d7dc1e137"
startedAt: "2026-09-29T07:01:02.939Z"
completedAt: "2026-09-29T07:21:36.984Z"
endedAt: "2026-09-29T07:21:36.984Z"
resolutionType: "code-change"
resolutionDetail: "layout/src/band.ts: bandOf (runs by edge kind+direction; small runs whole, others planned: byKind / chooseGrouping over arrangeable groups excluding the relation's edge, coverage ≥ 0.5, never one group of all, ~5 groups preferred / door; biggest groupings fall back to doors when over; leftover to standing members by relevance in natural order or to an opened group), shares (water-filling), chooseGrouping, isBandAggregate. Budget = perRow × max(2, rows at a 26px chip scaled by unit/16) — the first cut (perRow × 2, and a unit mistaken for 1) grouped todo's twelve raised tasks, which verify-navigation caught. Aggregate.opens (place → toggleExpanded; picture → focus aggregate:<kind> with in.filter=<edge>:<focus>). react: BandCard (name, count, first names, lit by hits), band groups selected as themselves, jack-in opens, host name 'Single, 80 albums'; relevance (hits, flagged, touchWeights) passed into LayoutOptions. core: year and decade buckets (row offers them). Hub: 36 hosts, 50 strands (was 1,259 / 2,214); aHubStopIsBounded and everyGroupOpens hold; navigation, menu, lines, shrunk hold. Tests: the-band-draws-what-fits (7), bucket tests."
acceptanceCriteria:
  - "focusing Tech N9ne draws at most the band's budget of cards and groups, each group named in the declaration's words with a true count"
  - "pressing a group is a stop: its members take the band (grouped again if over), Back closes it, the keyboard reaches it and a screen reader hears its name and count"
  - "no band ever draws a line to something it does not draw; a group takes one line per relation with its count"
  - "below the budget the band is exactly today's: the existing harness chain holds"
  - "unit tests hold grouping choice, relevance order and the year/decade buckets"
description: "The band's budget is perRow × 2 at the crowd width, from the settled layout; its row height has a floor. Over budget each relation run groups its far ends by the best of arrangeable(kind).groups — another edge's far end, a choice or boolean, a date by year or decade (the arrangement gains year and decade buckets) — excluding the relation's own edge and groupings where one group holds all; chosen deterministically (declared arrangedBy.group first, then fill of the share, named coverage, offer order). Groups are aggregates with ids naming what they are, labelled in the declaration's words with their count, drawn by the Group view, opened by the existing expanded toggle (a stop Back undoes) and grouped again if still over. With no grouping, the most relevant share−1 stand as themselves and one '+N more' aggregate holds the rest. Relevance: selection and reach, search hits, flagged, recently touched, degree among what is drawn, natural order, stable by id. Lines follow marks: one bundled line per relation to a group, captioned with its count."
lastModified: "2026-09-29T07:21:37.052Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
