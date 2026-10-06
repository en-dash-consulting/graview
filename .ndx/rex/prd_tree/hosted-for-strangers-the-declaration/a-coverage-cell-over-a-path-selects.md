---
id: "e44cbbba-590f-4801-bc8e-7f4ec8ce2a81"
level: "feature"
title: "A coverage cell over a path selects what it joins (FR-111)"
status: "pending"
priority: "medium"
tags:
  - "graview-cloud"
  - "FR-111"
  - "bug"
source: "Graview Cloud, 2026-10-06 (handoff: building En Dash Org through Claude, on 0.1.12)"
acceptanceCriteria:
  - "Choosing a filled cell selects, and draws its line to, the row record and the column record (and the record on the path, if drawn), never a collapsed kind's district"
  - "On the org app's Strengths lens, choosing Ryan x SEO draws to Ryan and to SEO, on both faces"
description: "A coverage lens with link: { path: [inSkill, has] } drew the selection line to the collapsed strength district."
lastModified: "2026-10-06T20:49:02.606Z"
---
