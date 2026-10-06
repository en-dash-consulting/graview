---
id: "cb40fbe6-0fd7-4f8a-a255-a56a7dedf1cb"
level: "feature"
title: "Run a worker view headless and describe it, in an isolated environment (FR-95)"
status: "completed"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-95"
  - "chat-authored"
  - "security"
  - "tier-2"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.9: chat-authored interfaces, ADR 0007)"
startedAt: "2026-10-06T03:56:09.000Z"
completedAt: "2026-10-06T03:56:09.000Z"
endedAt: "2026-10-06T03:56:09.000Z"
acceptanceCriteria:
  - "Given a view module and a store seated as one principal, run it once with no network and return what it drew (as FR-89) or why it failed; runs in any isolated JS environment a host provides, never in the host's own context"
  - "The LifeLogics lenses as worker views run headless and describe correctly; a view that throws, breaks a limit or names an unknown act or kind returns a failure naming it"
description: "Cloud checks a chat's view before applying it."
lastModified: "2026-10-06T03:56:09.000Z"
---
