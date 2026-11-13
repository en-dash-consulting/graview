---
id: "eb19b250-7cee-40dd-9659-2b6551d304a1"
type: "change"
title: "A kind's list page draws the view of many that asks to replace it, whatever the registration order (FR-238)"
slug: "f-list-page-draws-the-replacing-view"
intent: "Nick's Neumo Recon ticket (2026-11-12): DefaultListPage takes views.lookup(kind, many x full) and replaces the list only if that view says replaces: \"page\"; tidy-views' exact() answers the last registration of the cell, so a second view of many registered later wins and the list stays plain. Ask: the list page draws a registered, untidied view of many of the kind whose manifest says replaces: \"page\" (the last such if several), independent of the default cell; and a helper a host can call (listPageViewOf(registry, kind)) to say which. Cloud records it as FR-238; list it in capabilities().shipped."
acceptanceCriteria:
  - "A list page draws the replacing view whichever order the kind's views registered in (test and harness)"
  - "listPageViewOf answers the view the list page draws, or none (test)"
  - "capabilities().shipped names FR-238 (test)"
touches:
  - "5fd9c76f-1dc7-477f-8e1a-4130f74102df"
priority: "high"
tags:
  - "graview"
  - "pages"
  - "primitives"
  - "hq:feature:f-list-page-draws-the-replacing-view"
source: "Graview HQ feature:f-list-page-draws-the-replacing-view"
---
