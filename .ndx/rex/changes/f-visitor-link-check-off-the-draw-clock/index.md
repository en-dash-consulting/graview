---
id: "5e577081-02fe-400e-9f46-88ca39471ce7"
type: "change"
title: "A visitor's view is not stopped by the link check"
slug: "f-visitor-link-check-off-the-draw-clock"
intent: "Cloud, 2026-11-10: a public app's home view was stopped for every signed-out visitor and drew well for its owner. Profiled on production, one 553 ms long task was 549 ms of draw -> apply -> link -> kindsKeptFrom -> permittedMutations: kindsKeptFrom was called 671 times in one draw (543 ms), about 0.87 ms a call for a seat under a `sees` rule and 0.08 ms for the owner, because the view host's kept() worked it out again for every link through lists(), vocabulary() and createLinks, and the session's navigate did the same. Ask: work out what a seat may see and do once per batch or store state, never stale after a commit, a seat change or a declaration change."
acceptanceCriteria:
  - "A visitor's view handed 57 records with pictures and four links each asks kindsKeptFrom once for the batch, not once a link (test)"
  - "The store keeps kindsKeptFrom per seat while nothing it reads has changed, and works it out again after a commit, a reread, the day turning, field sight or publishing loading, or another seat asking (test)"
  - "Two stores never share an answer, so a changed declaration is a fresh answer (test)"
touches:
  - "ff8f3a6a-c556-4d4d-af6d-8b3909283a50"
  - "1cccd24b-2ecb-4ffe-858b-377eed4693c6"
priority: "high"
tags:
  - "graview"
  - "guest"
  - "core"
  - "hq:feature:f-visitor-link-check-off-the-draw-clock"
source: "Graview HQ feature:f-visitor-link-check-off-the-draw-clock"
---
