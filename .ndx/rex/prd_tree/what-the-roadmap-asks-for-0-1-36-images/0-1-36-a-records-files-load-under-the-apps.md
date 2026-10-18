---
id: "dd4ba5b7-009d-424d-99af-89fe785dc927"
level: "task"
title: "0.1.36 · A record's pictures and documents load where the host serves them, on every face"
status: "pending"
priority: "critical"
tags:
  - "roadmap"
  - "0.1.36"
source: "ndx-capture"
acceptanceCriteria:
  - "HostFiles carries a resolver (src(href)) that every place the framework draws or links a record's file goes through: thumbnails, image blocks, galleries, document links and downloads, on the scene and Pages"
  - "filesAt(url) derives it from its own url, so a host that hands filesAt(base + '/graview/files') gets pictures under its base with no other change; a test fails on 0.1.35"
  - "a worker or guest view the framework mounts takes file from it unless told otherwise"
description: "Found while triaging the 0.1.36 view-picture bugs: Graview Cloud serves an app's files only at /a/<app>/graview/files/… and records keep /graview/files/… without the base, so packages/primitives/src/files.tsx's <img src={file.href}> asks the workspace root. Cloud's own face thumbnails and galleries are likely not loading."
lastModified: "2026-10-18T19:20:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
