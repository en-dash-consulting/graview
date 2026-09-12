---
id: "95c9106e-8d79-4a82-8570-6bebe140b3eb"
level: "task"
title: "Walkthrough D · Lenses"
status: "in_progress"
priority: "critical"
tags:
  - "walkthrough"
  - "lens"
startedAt: "2026-09-11T17:25:06.329Z"
resolutionType: "code-change"
resolutionDetail: "Stage D walked: the coverage lens registered over owner×item with the title \"Who is seeing to what\", and a lens of the app's own — a load lens binding holders/held/via, titled \"How the work is spread\" — written per the graview-lens skill and proven reusable by a test in a domain it was not written for (engineers and tickets). graview check reads both declarations and names lens-binding-undeclared-kind and lens-role-unbound for the app's own lens, not only the framework's. Four findings fixed with criteria: W-013 a district with a lens over it burst into chips instead of going into the lens (layout + react); W-014 half the coverage grid's emphasis existed only as a colour, and the new audit-ui criterion then found the same in apps/todo (primitives); W-015 a lens place could not be visited while its kind was empty — the layout drew no card for a group holding nobody (layout); W-016 both shipped lenses threw a binding error on an empty graph (primitives). Verified: both titles are pills in the bar, pressed while there, and pressing one from a record returns to the lens; every mark is a pick target with tabindex and role, and selection lights it and dims the rest with data-graview-emphasis saying so on all of them; from altitude a group with a lens keeps its card and goes into the lens while a group without one opens as its district; both lenses read the whole graph; the grid has all its rows and columns and neither lens falls over on an empty graph. axe clean across 1280/390 × dark/light on the empty and populated states of both lenses."
acceptanceCriteria:
  - "the title is a place on the bar and the embed strip, pressed while there, and pressing it from a record returns to the lens"
  - "every mark is a pick target; selection lights it and dims the rest, and the DOM says so"
  - "from altitude a group with a lens keeps its card and shut district; a group without one opens as its district"
  - "the lens reads the whole graph; the board holds several occupants per slot; nothing throws on an empty graph"
description: "Stage D of docs/walkthrough.md: following graview-lens, register a starter lens with a title, then write a lens of the app's own over the same kinds."
lastModified: "2026-09-12T04:14:40.665Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
