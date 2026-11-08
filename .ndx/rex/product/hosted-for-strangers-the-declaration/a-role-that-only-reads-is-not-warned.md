---
id: "2da41444-ab48-4789-a445-682221257285"
type: "capability"
title: "A role that only reads is not warned that it may do nothing"
slug: "a-role-that-only-reads-is-not-warned"
statement: "The role-may-do-nothing check warns only about a role that can neither read nor act, and not about a role that only reads."
criteria: [{"id":"c1","text":"When a role has read grants, role-may-do-nothing shall not fire on it."},{"id":"c2","text":"When a role is named by the declaration as its reader, role-may-do-nothing shall not fire on it."},{"id":"c3","text":"When a role can neither read nor act, role-may-do-nothing shall fire on it."}]
tags:
  - "graview-cloud"
  - "checker"
  - "roles"
source: "Graview Cloud, 2026-10-10 (the framework brief after 0.1.20, ../graview-cloud/docs/framework-brief-0.1.21.md)"
priority: "high"
resolution: "Fixed in #192: role-may-do-nothing fires only for a role that can neither run a mutation nor see a kind (no sees, or a sight naming it, is reading)."
---

role-may-do-nothing fires on every Cloud template's viewer role and a fixture; a role that may only read is the point of a viewer, so the warning says nothing a builder should act on.
