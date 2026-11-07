---
id: "f29ad225-6be0-448e-907a-0e5443b8d186"
type: "capability"
title: "Every harness honours GRAVIEW_PORT_BASE, so a second checkout can run any of them"
slug: "every-harness-honours-graview-port"
statement: "Every browser harness, including companion, seat, audit and each verify-*.mjs that names a port, serves and navigates on the port derived from GRAVIEW_PORT_BASE when it is set, so a second checkout can run any of them."
criteria: [{"id":"c1","text":"When GRAVIEW_PORT_BASE is set, each of the companion, seat, audit and verify-*.mjs harnesses that names a port shall serve and navigate on GRAVIEW_PORT_BASE + (port − 5190)."},{"id":"c2","text":"When GRAVIEW_PORT_BASE is set, every harness shall run its dev servers outside the 5190–5399 range."}]
tags:
  - "follow-up"
source: "Landing Cloud's brief after 0.1.2, 2026-10-03"
priority: "medium"
---

Found landing FR-40: only verify-journeys reads GRAVIEW_PORT_BASE; 22 harnesses write their port into every URL.
