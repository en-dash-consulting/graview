---
id: "a5dbf8e4-9f15-47e2-bb0c-defc68cd2fac"
type: "capability"
title: "An agent acts for someone, through something: delegation and channel on every op, and seat headers trusted only on request"
slug: "an-agent-acts-for-someone-through"
statement: "An agent's ops record who it acted for and through which channel, and a served store trusts seat headers only when told to."
criteria: [{"id":"c1","text":"When an agent applies an op on behalf of a person, the store shall record both the agent and the person, and the activity rail shall read 'Claude, for Nick'."},{"id":"c2","text":"The store shall limit an agent acting for a person to the intersection of the agent's own roles and that person's roles."},{"id":"c3","text":"If an agent calls an act beyond the intersection of its roles and its person's roles, the store shall refuse the call with the policy's sentence."},{"id":"c4","text":"While trustSeatHeaders is not set, serveStore shall ignore the x-graview-seat header."},{"id":"c5","text":"If trustSeatHeaders is not set and no seatOf is supplied, serveStore shall answer 401."},{"id":"c6","text":"If graview serve is bound to a non-loopback address and --trust-seat-headers is not given, graview serve shall refuse to start with trusted seat headers."}]
tags:
  - "graview-cloud"
  - "FR-06"
  - "security"
source: "Graview Cloud FR-06, 2026-10-02"
priority: "high"
---

WHAT IS THERE NOW: Author {kind, id}; the default seatOf reads x-graview-seat and x-graview-roles and always sets kind human, so graview mcp --remote-url against graview serve records an agent as a person; anyone who can reach a served store can claim any seat by header. MISSING: 'Claude, for Nick, via chat' as a fact in the log, and a served store that does not believe a header by default. POSITION: Principal.onBehalfOf (the person an agent acts for, whose roles bound the agent's), op via (web, mcp:<client>, view:<name>, api, cli); the activity rail and history read it; take-back by participant; serveStore honours SEAT_HEADERS only with trustSeatHeaders: true (graview serve sets it for localhost-only binds and says so), otherwise seatOf must be supplied.
