---
id: "176ba96d-06b3-430a-987c-d1820524c902"
level: "task"
title: "0.1.39 · FR-192: A pictures: true view draws a full-size record photo, and the headless run fails as the page does"
status: "completed"
completedAt: "2026-10-19T21:30:00.000Z"
priority: "critical"
tags:
  - "roadmap"
  - "graview-cloud"
  - "0.1.39"
source: "ndx-capture"
acceptanceCriteria:
  - "a pictures: true view is handed a src that always draws for a record picture (the host's address through HostFiles.src, or a thumbnail under any cap), never a refused data: URI"
  - "if a cap stays it is said in the refusal; EXIF (APP1) JPEGs are accepted"
  - "the headless run (describe_place / propose_view) reports what the page would refuse; tests fail first with a full-size EXIF JPEG fixture"
description: "Roadmap f-view-picture-src-large (FR-192, now): Maryland Family Weekend's journey view falls back to the declared home once its moments hold 187 KB-1.5 MB JPEGs; the toast says the data:image/jpeg URI was not drawn; describe_place passed because the headless stand-in src hides it."
lastModified: "2026-10-19T21:30:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
