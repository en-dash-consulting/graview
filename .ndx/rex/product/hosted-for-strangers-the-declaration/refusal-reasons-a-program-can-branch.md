---
id: "383a0ee4-a78e-4ba3-a6ae-8163898487ab"
type: "capability"
title: "Refusal reasons a program can branch on: forbidden, missing, invalid, limit, with wouldNeed (FR-46)"
slug: "refusal-reasons-a-program-can-branch"
statement: "When the product refuses an action, it reports a reason code (forbidden, missing, invalid or limit) that a program can branch on, in place of a sentence it would have to match."
criteria: [{"id":"c1","text":"When an action is refused, the product shall set refused.reason to exactly one of forbidden, missing, invalid or limit."},{"id":"c2","text":"When an action is refused and the policy knows the roles that would allow it, the product shall list those roles in wouldNeed."},{"id":"c3","text":"The product shall list the refusal reason codes on its stability surface."}]
tags:
  - "graview-cloud"
  - "FR-46"
source: "Graview Cloud FR-46, 2026-10-03 (brief after 0.1.2)"
priority: "medium"
---

MCP tools and the interface say different things for "you may not" and "it is gone"; Cloud matches on sentences today.
