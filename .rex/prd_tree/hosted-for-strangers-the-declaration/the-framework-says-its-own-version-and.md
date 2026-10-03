---
id: "f1606df5-1580-4656-b53c-66729f308e5c"
level: "task"
title: "The framework says its own version, and rule failures are structured"
status: "pending"
priority: "low"
tags:
  - "graview-cloud"
  - "operations"
source: "Graview Cloud self-healing room, 2026-10-02"
acceptanceCriteria:
  - "import { FRAMEWORK_VERSION } from '@graview/core' matches the package version"
  - "A rule that throws yields a violation with status could-not-judge"
description: "Hosts record which framework version folded a store (for upgrade waves and diagnosis), but @graview/core exports no version constant. A rule that could not be judged or ran out of budget is only distinguishable by its message text, which Cloud matches by regex. POSITION: export FRAMEWORK_VERSION; violations carry a status ('violated' | 'could-not-judge' | 'over-budget') and health() counts them."
lastModified: "2026-10-02T23:14:56.845Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
