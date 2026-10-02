---
id: "6633d590-603d-48de-8d40-45109246f757"
level: "feature"
title: "Views as data: a card, a row and a badge declared rather than written, and drawn by the framework"
status: "pending"
priority: "medium"
tags:
  - "graview-cloud"
  - "FR-03"
blockedBy:
  - "3b647ea3-7070-40ee-b351-5115f42c5d3f"
  - "cdd910b9-7729-4f95-a821-3d59c35edb3b"
source: "Graview Cloud FR-03, 2026-10-02"
acceptanceCriteria:
  - "A spec-registered card renders in the workbench and the pages face with no component code"
  - "graview check refuses a spec naming a field the kind lacks or a tone outside the kit"
  - "Specs pass the audit-ui and a11y harnesses in both schemes"
description: "WHAT IS THERE NOW: a view is a React component registered with createViews, running in-process with the whole store. MISSING: a way for someone who cannot write React — or an agent in a chat — to make an app look like their thing, which a host of strangers can accept because it runs no code. POSITION: a view-spec vocabulary (title, text, badge with tone, field with as, progress, group, row, stack, divider, figure) over an allowlisted component kit, bound to fields by path, conditions and tones in the FR-07 language, registered per (kind × cell) like a component view and drawn by @graview/primitives and @graview/pages; tokens only, no raw CSS; checked by graview check."
lastModified: "2026-10-02T20:55:20.532Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
