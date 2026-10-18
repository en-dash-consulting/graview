---
id: "8725f7aa-4bc7-460a-9324-1bc804e5f7fc"
level: "task"
title: "0.1.35 · A host says whether a file is still kept asynchronously"
status: "pending"
priority: "high"
tags:
  - "roadmap"
  - "graview-cloud"
  - "0.1.35"
source: "ndx-capture"
acceptanceCriteria:
  - "HostFiles.kept may answer a Promise<boolean> (or the host hands a kept list once); playback draws a removed file as removed later when the answer comes, kept until then"
  - "a test with an async kept fails on 0.1.34 and passes after; a synchronous kept still works unchanged"
description: "Roadmap f-files-kept-async. HostFiles.kept?(href): boolean (packages/core/src/schema/files.ts) is synchronous; Cloud serves files from R2 and cannot answer at once, so playback draws every past picture as kept."
lastModified: "2026-10-18T16:00:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
