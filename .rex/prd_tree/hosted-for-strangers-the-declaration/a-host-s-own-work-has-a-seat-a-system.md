---
id: "e3331c44-2a66-441b-9fa6-ea995f97d08e"
level: "task"
title: "A host's own work has a seat: a system principal the policy lets through, and authors named by their own name"
status: "completed"
priority: "medium"
tags:
  - "graview-cloud"
  - "FR-06"
source: "Graview Cloud build, 2026-10-02"
startedAt: "2026-10-03T02:06:03.433Z"
completedAt: "2026-10-03T02:06:03.433Z"
endedAt: "2026-10-03T02:06:03.433Z"
acceptanceCriteria:
  - "Store.apply with {kind:'system'} succeeds under any policy and is attributed to the system"
  - "An op whose author carries name shows that name in the rail and in describe"
description: "Two things a host meets at once. (1) There is no superuser: roles ['*'] matches no grant, so a host applying template setup, seed or migrations as the system is refused by the app's own policy; Cloud gives its system principal every role the policy names. (2) nameOfAuthor reads a graph node or a seat and ignores an author's own name, so another person's or an agent's ops read as their raw id ('agent:claude:acct_…') in the rail. POSITION: Principal kind 'system' passes policy (it is not a role), and nameOfAuthor falls back to author.name before the id. Fold into FR-06."
lastModified: "2026-10-03T02:06:03.635Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
