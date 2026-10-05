---
id: "b04b600e-401f-49a1-97a0-a8539408dd70"
level: "feature"
title: "A seamless app-creation flow: the walkthrough"
status: "pending"
priority: "critical"
tags:
  - "walkthrough"
  - "quality"
  - "scene"
  - "pages"
source: "Nick, 2026-09-10: \"i'm still seeing quite a few bugs in the interfaces, both in the demo page we've been building, and the apps we've built using the package. i think we need to do a more robust walk-through of spinning up a new app, with clear acceptance criteria along the way\""
startedAt: "2026-09-11T19:51:47.517Z"
endedAt: "2026-09-13T05:09:13.023Z"
acceptanceCriteria:
  - "docs/walkthrough.md is followed stage by stage by an agent that has not seen the repository"
  - "every finding is logged, fixed in a package, and covered by a harness criterion in the same commit"
  - "a second run from a fresh checkout adds nothing to the findings log"
description: "The plan is docs/walkthrough.md: a new app created beside the framework with `graview create`, worked through nine stages (the blank app; a second kind and an edge; a rule and its repair; lenses; the pages customised; who may do what; remembering and shipping; on somebody else's page; the cross-cutting pass) in both faces, both schemes and both widths, with acceptance criteria per stage. Every finding goes in docs/walkthrough-findings.md, is fixed in the framework package it belongs to (never only in the app), and gains the harness criterion that should have caught it. Done when a second agent works all nine stages from the kick-off prompt and the findings log gains nothing."
lastModified: "2026-09-29T02:37:55.675Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Children

| Title | Status |
|-------|--------|
| [Walkthrough A · The blank app](./walkthrough-a-the-blank-app.md) | completed |
| [Walkthrough B · A second kind and an edge](./walkthrough-b-a-second-kind-and-an-edge.md) | completed |
| [Walkthrough C · A rule and its repair](./walkthrough-c-a-rule-and-its-repair.md) | completed |
| [Walkthrough D · Lenses](./walkthrough-d-lenses.md) | completed |
| [Walkthrough E · The pages, customised](./walkthrough-e-the-pages-customised.md) | completed |
| [Walkthrough F · Who may do what](./walkthrough-f-who-may-do-what.md) | completed |
| [Walkthrough G · Remembering and shipping](./walkthrough-g-remembering-and-shipping.md) | completed |
| [Walkthrough H · On somebody else's page](./walkthrough-h-on-somebody-else-s-page.md) | completed |
| [Walkthrough I · The cross-cutting pass](./walkthrough-i-the-cross-cutting-pass.md) | completed |
| [Walkthrough II · The second walk, from a fresh checkout, adds nothing](./walkthrough-ii-the-second-walk-from-a.md) | completed |
| [Walkthrough III · The third walk, from a fresh checkout, adds nothing](./walkthrough-iii-the-third-walk-from-a.md) | completed |
| [Walkthrough IV · The fourth walk, from a fresh checkout, adds nothing](./walkthrough-iv-the-fourth-walk-from-a.md) | completed |
| [Walkthrough V · The fifth walk, from a fresh checkout, adds nothing](./walkthrough-v-the-fifth-walk-from-a.md) | completed |
| [Walkthrough VI · The sixth walk, from a fresh checkout, adds nothing](./walkthrough-vi-the-sixth-walk-from-a.md) | completed |
| [Walkthrough VII · The seventh walk, from a fresh checkout, adds nothing](./walkthrough-vii-the-seventh-walk-from.md) | failing |
| [Walkthrough VIII · The eighth walk, from a fresh checkout, adds nothing](./walkthrough-viii-the-eighth-walk-from.md) | pending |
| [What a seat may not see never leaves the store: sees applied by graview mcp, graview serve and the served store, and editable in the studio](./what-a-seat-may-not-see-never-leaves.md) | completed |
