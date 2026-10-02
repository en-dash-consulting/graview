---
id: "7c0a21d0-76c2-4098-b883-f06622a6854c"
level: "task"
title: "Registering one view layers over the defaults instead of replacing them, and a default can be wrapped"
status: "pending"
priority: "medium"
tags:
  - "graview-cloud"
  - "FR-03"
  - "FR-36"
source: "Graview Cloud Tier 1 views, 2026-10-02"
acceptanceCriteria:
  - "mount({ views }) keeps every default it does not override"
  - "A view can render the default for its cell inside itself"
description: "EmbedOptions.views replaces registerDefaultViews, so a host that wants one custom cell must re-register every default and look the default full view up from a second registry to draw above it."
lastModified: "2026-10-02T23:39:48.524Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
