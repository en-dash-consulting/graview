---
id: "0f191cda-c2f4-4e49-bd83-28399a01216a"
level: "feature"
title: "A compacted log keeps who made each record, so an own sight survives a restart"
status: "completed"
priority: "medium"
tags:
  - "follow-up"
source: "Landing Cloud's brief after 0.1.2, 2026-10-03"
startedAt: "2026-10-04T05:39:54.031Z"
completedAt: "2026-10-04T05:39:54.031Z"
endedAt: "2026-10-04T05:39:54.031Z"
acceptanceCriteria:
  - "A store reopened on a compacted log knows the creator of a record made behind the horizon"
  - "An own sight based on the creator alone sees the same records before and after a restart"
description: "FR-51 follow-up: recordsOf now remembers creators across compaction in an open log, but a log opened already compacted knows creators only from its horizon on. Keeping creators in the checkpoint epoch is a stored-format change, so it needs a Compatibility line and a format note."
lastModified: "2026-10-04T05:39:54.136Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
