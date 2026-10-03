---
id: "f71a93c8-260a-4e13-b968-e46d74f68994"
level: "feature"
title: "Backpressure distinct from refusal: busy with retryAfter, and the client re-sends (FR-45)"
status: "pending"
priority: "medium"
tags:
  - "graview-cloud"
  - "FR-45"
source: "Graview Cloud FR-45, 2026-10-03 (brief after 0.1.2)"
acceptanceCriteria:
  - "The server can answer { t: \"busy\", cid?, retryAfter }"
  - "The client keeps the call pending and re-sends after retryAfter rather than taking the change back"
  - "Over the rate, a burst of calls all land in order, none shown as refused, and the pending count drains"
description: "Rate limits and size caps are tenancy protections; calling them refusals loses work."
lastModified: "2026-10-03T17:32:15.000Z"
---
