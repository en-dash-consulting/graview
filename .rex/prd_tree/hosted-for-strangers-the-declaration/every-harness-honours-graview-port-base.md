---
id: "f29ad225-6be0-448e-907a-0e5443b8d186"
level: "feature"
title: "Every harness honours GRAVIEW_PORT_BASE, so a second checkout can run any of them"
status: "pending"
priority: "medium"
tags:
  - "follow-up"
source: "Landing Cloud's brief after 0.1.2, 2026-10-03"
acceptanceCriteria:
  - "companion, seat, audit and every verify-*.mjs that names a port serve and navigate on GRAVIEW_PORT_BASE + (port \u2212 5190) when it is set"
  - "CLAUDE.md's claim that a worktree runs its dev servers outside 5190\u20135399 holds for every harness"
description: "Found landing FR-40: only verify-journeys reads GRAVIEW_PORT_BASE; 22 harnesses write their port into every URL."
lastModified: "2026-10-03T19:14:55.000Z"
---
