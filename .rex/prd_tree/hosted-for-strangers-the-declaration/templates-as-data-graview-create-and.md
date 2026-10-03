---
id: "b7202ccb-5bd7-41e7-a044-46571520854e"
level: "feature"
title: "Templates as data: graview create and graview apply take a template made anywhere"
status: "pending"
priority: "medium"
tags:
  - "graview-cloud"
  - "FR-08"
blockedBy:
  - "cdd910b9-7729-4f95-a821-3d59c35edb3b"
source: "Graview Cloud FR-08, 2026-10-02"
acceptanceCriteria:
  - "graview create --template vendor-shortlist.json makes a project whose verify passes and whose graview describe matches the template's document"
  - "graview apply --template runs the setup acts as one attributed, undoable batch"
description: "WHAT IS THERE NOW: @graview/core/scaffold generates one project shape in-process. MISSING: a template someone made and shared in a hosted service scaffolding a self-hosted project, which is the anti-lock-in claim for templates. POSITION: graview create --template <file|url> scaffolds a TS project from a graview-template (document + setup questions + seed, format at ../graview-cloud/docs/templates.md) and graview apply --template instantiates one into a live store, setup as attributed ops."
lastModified: "2026-10-02T20:55:21.260Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
