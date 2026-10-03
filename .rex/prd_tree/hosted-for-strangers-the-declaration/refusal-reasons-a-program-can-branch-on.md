---
id: "383a0ee4-a78e-4ba3-a6ae-8163898487ab"
level: "feature"
title: "Refusal reasons a program can branch on: forbidden, missing, invalid, limit, with wouldNeed (FR-46)"
status: "pending"
priority: "medium"
tags:
  - "graview-cloud"
  - "FR-46"
source: "Graview Cloud FR-46, 2026-10-03 (brief after 0.1.2)"
acceptanceCriteria:
  - "refused.reason is one of forbidden, missing, invalid, limit; wouldNeed lists roles when the policy knows them"
  - "Each reason is produced by a test that names it"
  - "The codes are on the stability surface"
description: "MCP tools and the interface say different things for \"you may not\" and \"it is gone\"; Cloud matches on sentences today."
lastModified: "2026-10-03T17:32:15.000Z"
---
