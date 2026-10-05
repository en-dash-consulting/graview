---
id: "1cccd24b-2ecb-4ffe-858b-377eed4693c6"
level: "feature"
title: "Limits and fallback for worker views: bytes, nodes, messages and CPU per push (FR-94)"
status: "pending"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-94"
  - "chat-authored"
  - "security"
  - "tier-2"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.9: chat-authored interfaces, ADR 0007)"
acceptanceCriteria:
  - "The host caps source bytes, rendered nodes, messages per second and CPU time per props push; past any limit it stops the worker, draws the kind's Tier 1 face, and reports why via onFailure"
  - "A view that spins, floods messages or renders 100k nodes is stopped within the budget, the Tier 1 face is shown, and the reason reported"
description: "Extends 0.1.8's watchdog and acts/maxNodes limits."
lastModified: "2026-10-05T20:03:32.950Z"
---
