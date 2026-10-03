---
id: "fa1994f9-4676-46d3-a9d4-28308d38a85a"
level: "task"
title: "A store can hold records that no longer fit while still checking new writes"
status: "completed"
priority: "medium"
tags:
  - "graview-cloud"
  - "operations"
  - "FR-21"
source: "Graview Cloud self-healing room, 2026-10-02"
startedAt: "2026-10-03T04:57:03.068Z"
completedAt: "2026-10-03T04:57:03.068Z"
endedAt: "2026-10-03T04:57:03.068Z"
acceptanceCriteria:
  - "A store opens over records that no longer fit, reports them, and still refuses a new write that does not fit"
  - "Opening never changes a stored node's fields"
description: "Store validation is fixed at construction: either every record must parse (and a store whose old records no longer fit cannot open) or nothing is checked (and new writes go unvalidated). Validation can also alter a node (zod strips or coerces), so validated and unvalidated folds differ. Cloud opens such rooms unvalidated until a repair and a wake. POSITION: validate writes always; tolerate existing misfits as findings (validateGraph) rather than refusing to open; never let parsing silently change a stored node."
lastModified: "2026-10-03T04:57:03.151Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
