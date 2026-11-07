---
id: "7c0a21d0-76c2-4098-b883-f06622a6854c"
type: "change"
title: "Registering one view layers over the defaults instead of replacing them, and a default can be wrapped"
slug: "registering-one-view-layers-over-the"
intent: "EmbedOptions.views replaces registerDefaultViews, so a host that wants one custom cell must re-register every default and look the default full view up from a second registry to draw above it."
acceptanceCriteria:
  - "mount({ views }) keeps every default it does not override"
  - "A view can render the default for its cell inside itself"
touches:
  - "f29ad225-6be0-448e-907a-0e5443b8d186"
priority: "medium"
tags:
  - "graview-cloud"
  - "FR-03"
  - "FR-36"
source: "Graview Cloud Tier 1 views, 2026-10-02"
---
