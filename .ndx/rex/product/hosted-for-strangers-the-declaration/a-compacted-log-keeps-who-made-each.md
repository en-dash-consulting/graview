---
id: "0f191cda-c2f4-4e49-bd83-28399a01216a"
type: "capability"
title: "A compacted log keeps who made each record, so an own sight survives a restart"
slug: "a-compacted-log-keeps-who-made-each"
statement: "A store reopened on a compacted log still knows who made each record, so a sight based on the creator alone sees the same records after a restart as before it."
criteria: [{"id":"c1","text":"When a store is reopened on a compacted log, the store shall know the creator of a record made behind the horizon."},{"id":"c2","text":"When a store is restarted, an own sight based on the creator alone shall see the same records it saw before the restart."}]
tags:
  - "follow-up"
source: "Landing Cloud's brief after 0.1.2, 2026-10-03"
priority: "medium"
---

FR-51 follow-up: recordsOf now remembers creators across compaction in an open log, but a log opened already compacted knows creators only from its horizon on. Keeping creators in the checkpoint epoch is a stored-format change, so it needs a Compatibility line and a format note.
