---
id: "2b16bb49-5218-4f2c-92ab-c8ad3ce5382c"
level: "task"
title: "0.1.34 · FR-185: Opening a context menu spends no thinking-model call"
status: "pending"
priority: "high"
tags:
  - "roadmap"
  - "graview-cloud"
  - "0.1.34"
source: "ndx-capture"
acceptanceCriteria:
  - "with only a thinking slot, opening and closing a context menu makes no AI call (a test counts calls)"
  - "asking for suggestions then takes one press (a Suggest row)"
  - "with a Fast slot, suggestions on open still come from the Fast slot; a host may turn suggest-on-open off"
description: "Roadmap f-menu-suggest-costs (FR-185, priority next). InlineAiMenu asks suggest on every open; suggestHere falls back to the thinking slot without a Fast one, about 0.65 Cloud credits per right-click. Lands with FR-186."
lastModified: "2026-10-18T03:00:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
