---
id: "e8a4f5b2-6d62-465e-9af0-060c2b8de56f"
type: "capability"
title: "Stored formats carry their version, and the next major brings the steps to read the last one"
slug: "stored-formats-carry-their-version-and"
statement: "Snapshots and bundles record the framework version and format that wrote them, and a reader that meets a newer snapshot format reports it instead of misreading it."
criteria: [{"id":"c1","text":"When a snapshot is written, the snapshot writer shall record its format as { framework, format }."},{"id":"c2","text":"When a bundle is written, the bundle writer shall record its format as { framework, format }."},{"id":"c3","text":"When a reader meets a snapshot written in a newer format than it knows, the reader shall report 'newer format' instead of folding the snapshot, so the host can refold from the log."},{"id":"c4","text":"Core shall export upgradeSnapshot(from) and upgradeOp(from) for every format change."},{"id":"c5","text":"When a bundle is asserted, assertBundle shall check the bundle's format."}]
tags:
  - "graview-cloud"
  - "versions"
  - "FR-31"
source: "Graview Cloud docs/framework-versions.md, 2026-10-02"
priority: "high"
---

WHAT IS THERE NOW: a snapshot and an op carry no format version; a host cannot tell which code wrote them. MISSING: rollback safety (the previous version must read what the new one wrote, or know to refold) and majors that change formats. POSITION: snapshots and bundles record { framework, format }; core exports upgradeSnapshot(from) and upgradeOp(from) for every format change; a reader meeting a newer snapshot format reports it (so the host refolds from the log) rather than misreading it; assertBundle checks the format.
