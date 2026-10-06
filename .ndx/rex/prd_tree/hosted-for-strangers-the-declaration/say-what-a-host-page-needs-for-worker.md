---
id: "7ebface6-a29e-4e0f-a1b9-bc2f32557c1d"
level: "feature"
title: "Say what a host page needs for worker views, and say when it is missing (FR-102)"
status: "pending"
priority: "medium"
tags:
  - "graview-cloud"
  - "FR-102"
  - "tier-2"
source: "Graview Cloud, 2026-10-06 (brief after 0.1.10)"
acceptanceCriteria:
  - "The guest README's host section lists the page policy an open-kit view needs (worker-src blob:, or the alternative if a host serves the runtime itself)"
  - "A worker that fails to start gets its own onFailure reason, start; a page without worker-src reports start once, not a silent plain face"
description: "Cloud's page had no worker-src, the browser fell back to script-src and refused the blob worker; every view drew its plain face with no clue why."
lastModified: "2026-10-06T15:08:48.160Z"
---
