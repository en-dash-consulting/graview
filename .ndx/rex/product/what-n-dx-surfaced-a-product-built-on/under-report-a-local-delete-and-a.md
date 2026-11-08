---
id: "b4e10e2d-6471-4da4-9259-08cd2238d737"
type: "capability"
title: "Under report, a local delete and a remote edit become a conflict"
slug: "under-report-a-local-delete-and-a"
statement: "Under conflicts \"report\", a local delete of a record that the remote edited since the last pull is reported as a conflict rather than silently winning."
criteria: [{"id":"c1","text":"When conflicts is \"report\" and a record is deleted locally after the remote edited it since the last pull, the sync engine shall report the delete and the edit as a conflict."},{"id":"c2","text":"When a local delete and a remote edit of the same record are reported as a conflict, resolve shall keep either the local side or the remote side."}]
tags:
  - "n-dx"
  - "sync"
source: "The review round before 0.1.22 (#207), 2026-10-11"
priority: "medium"
resolution: "Fixed in #211: a local delete of a record the remote edited is a DeletedConflict, held under report; resolve sends the delete (ours) or makes the record again through createInbound (theirs), and the theirs and ours policies do the same in the pass."
---

Under conflicts: "report", a local delete silently beats a remote edit.
