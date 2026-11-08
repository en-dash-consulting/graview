---
id: "f71a93c8-260a-4e13-b968-e46d74f68994"
type: "capability"
title: "Backpressure distinct from refusal: busy with retryAfter, and the client re-sends (FR-45)"
slug: "backpressure-distinct-from-refusal"
statement: "When a call exceeds a rate limit or size cap, the server answers busy with a retryAfter instead of refusing it, and the client keeps the call pending and re-sends it so no work is lost."
criteria: [{"id":"c1","text":"The server shall be able to answer a call with { t: \"busy\", cid?, retryAfter }."},{"id":"c2","text":"When the server answers busy, the client shall keep the call pending and re-send it after retryAfter rather than taking the change back."},{"id":"c3","text":"While calls arrive over the rate limit, the client shall land a burst of calls in order, show none as refused, and drain the pending count."}]
tags:
  - "graview-cloud"
  - "FR-45"
source: "Graview Cloud FR-45, 2026-10-03 (brief after 0.1.2)"
priority: "medium"
---

Rate limits and size caps are tenancy protections; calling them refusals loses work.
