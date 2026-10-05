---
id: "8dfa18c2-fbf4-460f-8c8e-7143e60bd789"
level: "feature"
title: "The embed loads the studio eagerly when the studio is the whole page (FR-63)"
status: "completed"
priority: "low"
tags:
  - "graview-cloud"
  - "FR-63"
source: "Graview Cloud, 2026-10-04 (brief after 0.1.4)"
startedAt: "2026-10-04T15:31:00.000Z"
completedAt: "2026-10-04T15:31:00.000Z"
endedAt: "2026-10-04T15:31:00.000Z"
acceptanceCriteria:
  - "mount(…, { studio: { onApply, eager: true } }), or the studio overlay exported on its own, puts no @graview/studio module in a lazy chunk of a bundle that mounts it"
description: "Cloud's /apps/:id/builder pays a round trip for a 109 KB chunk before the studio draws."
lastModified: "2026-10-04T15:31:00.000Z"
---
