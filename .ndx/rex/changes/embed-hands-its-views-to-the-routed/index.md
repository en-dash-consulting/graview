---
id: "bc824f1a-5c68-4c2a-9192-59f02eccc49a"
type: "change"
title: "Embed hands its views to the routed face too"
slug: "embed-hands-its-views-to-the-routed"
intent: "mount() builds PagesApp's context without the view registry, so a view registered through EmbedOptions.views draws in the workbench and never on the phone face. Cloud builds a home surface and a record page per kind by hand."
acceptanceCriteria:
  - "A view registered through mount({ views }) draws on the pages face's gallery and record page"
touches:
  - "6fa83cff-711f-471d-8ef0-a1365c5324ee"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-03"
  - "FR-35"
source: "Graview Cloud Tier 1 views, 2026-10-02"
---
