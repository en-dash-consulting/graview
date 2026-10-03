---
id: "7c0a21d0-76c2-4098-b883-f06622a6854c"
level: "task"
title: "Registering one view layers over the defaults instead of replacing them, and a default can be wrapped"
status: "completed"
priority: "medium"
tags:
  - "graview-cloud"
  - "FR-03"
  - "FR-36"
source: "Graview Cloud Tier 1 views, 2026-10-02"
startedAt: "2026-10-03T05:28:04.940Z"
completedAt: "2026-10-03T05:28:04.940Z"
endedAt: "2026-10-03T05:28:04.940Z"
acceptanceCriteria:
  - "mount({ views }) keeps every default it does not override"
  - "A view can render the default for its cell inside itself"
description: "EmbedOptions.views replaces registerDefaultViews, so a host that wants one custom cell must re-register every default and look the default full view up from a second registry to draw above it."
lastModified: "2026-10-03T05:28:05.035Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
