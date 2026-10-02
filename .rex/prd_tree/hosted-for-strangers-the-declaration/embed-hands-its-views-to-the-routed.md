---
id: "bc824f1a-5c68-4c2a-9192-59f02eccc49a"
level: "task"
title: "Embed hands its views to the routed face too"
status: "pending"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-03"
  - "FR-35"
source: "Graview Cloud Tier 1 views, 2026-10-02"
acceptanceCriteria:
  - "A view registered through mount({ views }) draws on the pages face's gallery and record page"
description: "mount() builds PagesApp's context without the view registry, so a view registered through EmbedOptions.views draws in the workbench and never on the phone face. Cloud builds a home surface and a record page per kind by hand."
lastModified: "2026-10-02T23:39:48.128Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
