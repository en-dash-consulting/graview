---
id: "e8a4f5b2-6d62-465e-9af0-060c2b8de56f"
level: "feature"
title: "Stored formats carry their version, and the next major brings the steps to read the last one"
status: "completed"
priority: "high"
tags:
  - "graview-cloud"
  - "versions"
  - "FR-31"
source: "Graview Cloud docs/framework-versions.md, 2026-10-02"
startedAt: "2026-10-03T02:06:05.019Z"
completedAt: "2026-10-03T02:06:05.019Z"
endedAt: "2026-10-03T02:06:05.019Z"
acceptanceCriteria:
  - "A snapshot written by version N records its format; version N-1 reading it says 'newer format' instead of folding it"
  - "A format change ships with an upgrade step and a test from the previous format's fixtures"
description: "WHAT IS THERE NOW: a snapshot and an op carry no format version; a host cannot tell which code wrote them. MISSING: rollback safety (the previous version must read what the new one wrote, or know to refold) and majors that change formats. POSITION: snapshots and bundles record { framework, format }; core exports upgradeSnapshot(from) and upgradeOp(from) for every format change; a reader meeting a newer snapshot format reports it (so the host refolds from the log) rather than misreading it; assertBundle checks the format."
lastModified: "2026-10-03T02:06:05.150Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
