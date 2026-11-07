---
id: "8725f7aa-4bc7-460a-9324-1bc804e5f7fc"
type: "change"
title: "0.1.35 · A host says whether a file is still kept asynchronously"
slug: "0-1-35-a-host-says-whether-a-file-is"
intent: "Roadmap f-files-kept-async. HostFiles.kept?(href): boolean (packages/core/src/schema/files.ts) is synchronous; Cloud serves files from R2 and cannot answer at once, so playback draws every past picture as kept."
acceptanceCriteria:
  - "HostFiles.kept may answer a Promise<boolean> (or the host hands a kept list once); playback draws a removed file as removed later when the answer comes, kept until then"
  - "a test with an async kept fails on 0.1.34 and passes after; a synchronous kept still works unchanged"
touches:
  - "635b55e6-c088-401a-ace2-6cb7088a7cb1"
priority: "high"
tags:
  - "roadmap"
  - "graview-cloud"
  - "0.1.35"
source: "ndx-capture"
---
