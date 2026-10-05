---
id: "1dd2559a-2f18-4b2b-827c-3ce8f07d5807"
level: "feature"
title: "A declared lens draws: a lenses entry maps to the shipped factory and is a named place (FR-79)"
status: "pending"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-79"
  - "chat-authored"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.9: chat-authored interfaces, ADR 0007)"
acceptanceCriteria:
  - "A lenses entry gets a title and data-only options; the embed maps each to createCoverageLens, createBoardLens, createTimelineLens, createCalendarLens, createPlanLens or reachLens and registers it as a named place for its kind (many, full, summary)"
  - "Options that can't be data get derived defaults; check validates bindings and options; plan joins the shipped names in check and describe"
  - "A document declaring one lens of each type shows each by title on the Graview face (pills, drive-in) and the Pages face (/places/:as); check and describe agree with what draws; a TypeScript app's declared lenses draw without its own registration code"
description: "Document lenses draw nothing and neither do TypeScript ones: only check and describe read app.lenses; a TS app's lens draws only because its UI code registers it."
lastModified: "2026-10-05T20:03:32.950Z"
---
