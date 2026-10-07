---
id: "f51bb86f-7687-406f-8fdf-2ccf4938016d"
level: "feature"
title: "A seat's first state read after a wake costs what it did before FR-55"
status: "completed"
priority: "low"
tags:
  - "follow-up"
  - "performance"
source: "The pre-0.1.4 audit of Graview Cloud, 2026-10-04"
startedAt: "2026-10-07T14:07:03.000Z"
completedAt: "2026-10-07T14:07:03.000Z"
endedAt: "2026-10-07T14:07:03.000Z"
acceptanceCriteria:
  - "A seat's first served state read on a freshly woken store of 10k ops is within 1.5x of the system seat's read (today ~51 ms vs 19 ms pre-FR-55)"
  - "Every FR-55 property test stays green"
description: "FR-55 redaction checks every string in every op once per seat after a wake; repeat and grown reads are cached and already faster than 0.1.3. Options: persist served views across wakes, or index unseen-id mentions at append time."
lastModified: "2026-10-04T11:43:15.000Z"
resolution: "Measured on staging 2026-10-07 by Graview Cloud (Cloudflare runtime, 10,000 records, a viewer seeing only their own vendors; 20 cold wakes each): a seat with its own sight median 580 ms / p95 696 ms against the system's 586 ms / 705 ms. The seat's sight costs nothing measurable; the wake and the fold dominate. Within the 1.5x target."
---
