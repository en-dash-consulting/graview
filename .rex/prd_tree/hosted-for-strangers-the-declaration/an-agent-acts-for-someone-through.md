---
id: "a5dbf8e4-9f15-47e2-bb0c-defc68cd2fac"
level: "feature"
title: "An agent acts for someone, through something: delegation and channel on every op, and seat headers trusted only on request"
status: "completed"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-06"
  - "security"
source: "Graview Cloud FR-06, 2026-10-02"
startedAt: "2026-10-03T02:06:01.758Z"
completedAt: "2026-10-03T02:06:01.758Z"
endedAt: "2026-10-03T02:06:01.758Z"
acceptanceCriteria:
  - "An op applied by an agent on behalf of a person records both and the rail reads 'Claude, for Nick'"
  - "An agent's roles are the intersection of its own and its person's; a call beyond them is refused with the policy's sentence"
  - "serveStore without trustSeatHeaders ignores x-graview-seat and answers 401 when no seatOf is supplied"
  - "graview serve bound to a non-loopback address refuses to start with trusted headers unless --trust-seat-headers is given"
description: "WHAT IS THERE NOW: Author {kind, id}; the default seatOf reads x-graview-seat and x-graview-roles and always sets kind human, so graview mcp --remote-url against graview serve records an agent as a person; anyone who can reach a served store can claim any seat by header. MISSING: 'Claude, for Nick, via chat' as a fact in the log, and a served store that does not believe a header by default. POSITION: Principal.onBehalfOf (the person an agent acts for, whose roles bound the agent's), op via (web, mcp:<client>, view:<name>, api, cli); the activity rail and history read it; take-back by participant; serveStore honours SEAT_HEADERS only with trustSeatHeaders: true (graview serve sets it for localhost-only binds and says so), otherwise seatOf must be supplied."
lastModified: "2026-10-03T02:06:01.912Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
