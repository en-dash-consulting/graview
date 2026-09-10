---
id: "ae535203-3dc4-4824-94e9-93157e388f0b"
level: "task"
title: "What the page taught the framework, folded back in"
status: "completed"
priority: "medium"
tags:
  - "lens"
  - "embed"
  - "defaults"
source: "claude-code session 2026-09-10"
startedAt: "2026-09-10T14:59:44.280Z"
completedAt: "2026-09-10T14:59:44.280Z"
endedAt: "2026-09-10T14:59:44.280Z"
resolutionType: "code-change"
resolutionDetail: "board occupants[], coverage self-feeding, embed faceOf/hostScheme/mountWhenNear; commit 992ac22"
acceptanceCriteria: []
description: "A board slot holds several occupants, each name its own target, and the bench lists only what is in no slot (a plot with two plantings had shown one and benched the other). The coverage lens reads its rows and columns from the graph, as the board did, so no app writes a wrapper to hand over the other kind. An embed infers its face from its stop and its scheme from the host page, and `mountWhenNear` mounts many embeds as a reader comes near — the page's own sweep, now the framework's. The scaffold's views file says how a lens becomes a place. Anything the demo had done by hand that the framework should do by default was moved into a package, overrideable."
lastModified: "2026-09-10T14:59:44.292Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
