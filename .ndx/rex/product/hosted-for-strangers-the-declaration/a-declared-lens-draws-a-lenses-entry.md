---
id: "1dd2559a-2f18-4b2b-827c-3ce8f07d5807"
type: "capability"
title: "A declared lens draws: a lenses entry maps to the shipped factory and is a named place (FR-79)"
slug: "a-declared-lens-draws-a-lenses-entry"
statement: "A Graview app's declared lenses draw as named places on both the Graview face and the Pages face, with check and describe agreeing with what draws."
criteria: [{"id":"c1","text":"When a document declares a lenses entry, the embed shall give it a title and data-only options and map it to createCoverageLens, createBoardLens, createTimelineLens, createCalendarLens, createPlanLens or reachLens, registering it as a named place for its kind (many, full, summary)."},{"id":"c2","text":"When a lens option cannot be expressed as data, the embed shall derive a default for it."},{"id":"c3","text":"The checker shall validate a lens's bindings and options."},{"id":"c4","text":"The checker and describe shall include the plan lens among the shipped lens names."},{"id":"c5","text":"When a document declares one lens of each type, the Graview face shall show each by its title as pills and drive-ins, and the Pages face shall show each at /places/:as."},{"id":"c6","text":"The checker and describe shall agree with the lenses that draw."},{"id":"c7","text":"When a TypeScript app declares lenses, the app shall draw them without registration code of its own."}]
tags:
  - "graview-cloud"
  - "FR-79"
  - "chat-authored"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.9: chat-authored interfaces, ADR 0007)"
priority: "high"
---

Document lenses draw nothing and neither do TypeScript ones: only check and describe read app.lenses; a TS app's lens draws only because its UI code registers it.
