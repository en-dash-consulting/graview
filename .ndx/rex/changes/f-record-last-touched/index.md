---
id: "aab164a5-9936-4ebf-91f5-165850253165"
type: "change"
title: "Every record says when it was last touched and by whom, kept by the system"
slug: "f-record-last-touched"
intent: "From Nick through Cloud (HQ feature:f-record-last-touched, brief:b-cloud-2026-11-21-record-last-touched): a view's nodes carry no created or updated time or last editor, no expression reads a record's last change, and history is archived too soon to backfill; an app's hand-made lastTouched date set by 15 acts missed files, links, imports and tidying and read in UTC. Keep createdAt/createdBy and updatedAt/updatedBy on every record, set by every op that touches it (fields, files, links at either end, imports, tidying, undo), the record's own so it survives compaction and the archive, and readable wherever a field is."
acceptanceCriteria:
  - "Every op that touches a record (a field, a file, a link at either end, an import, a tidying, an undo of any of these) sets its updatedAt and updatedBy; a create sets all four (test)"
  - "The four survive compaction, a snapshot and the archive, and a store from before them reads with createdAt from the record's first op it still holds or none, never an invented time (test)"
  - "A view's nodes, the host's find/get_node shape (describeRecord or its equivalent) and a seat's view carry them, judged by sight like any field (test)"
  - "A list can sort and filter by them, a template says {updated|relative} and {updated|day} in the app's time zone, and rules, computed fields and a job's where read them (test)"
  - "graview check refuses a kind that declares a field of one of these names (test)"
  - "docs/stability.md and the Compatibility line say what a stored format and a host gain"
priority: "medium"
tags:
  - "graview"
  - "core"
  - "hq:feature:f-record-last-touched"
source: "Graview HQ feature:f-record-last-touched"
---
