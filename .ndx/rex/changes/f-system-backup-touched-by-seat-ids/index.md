---
id: "b554b307-6788-4db6-8860-1c449492c59b"
type: "change"
title: "A system backup's createdBy and updatedBy are said as people where the reader may know them"
slug: "f-system-backup-touched-by-seat-ids"
intent: "From HQ feature:f-system-backup-touched-by-seat-ids (left from 0.2.10): an export or system backup keeps createdBy and updatedBy as raw seat ids with no binding. Carry the bound person's record id beside the seat in an export, keep the seat for a faithful restore, and say the person on restore. Private until built; public text neutral."
acceptanceCriteria:
  - "An export carries the bound person's record id beside each createdBy and updatedBy seat (test)"
  - "A restore from it is faithful and reads the four as before (test)"
priority: "medium"
tags:
  - "graview"
  - "core"
  - "ship"
  - "hq:feature:f-system-backup-touched-by-seat-ids"
source: "Graview HQ feature:f-system-backup-touched-by-seat-ids"
---
