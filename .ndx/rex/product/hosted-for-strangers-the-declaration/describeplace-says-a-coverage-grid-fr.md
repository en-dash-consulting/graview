---
id: "844cf3dc-9772-4503-9c95-34aefd43490d"
type: "capability"
title: "describePlace says a coverage grid (FR-112)"
slug: "describeplace-says-a-coverage-grid-fr"
statement: "describePlace on a coverage lens says a coverage grid: for each row, the columns it is linked to, and the column names."
criteria: [{"id":"c1","text":"When describePlace describes a coverage lens, it shall say for each row the columns that row is linked to, and for a path the joining record's label that links them."},{"id":"c2","text":"When describePlace describes a coverage lens, it shall say each column's count."},{"id":"c3","text":"When describePlace describes a coverage lens, it shall say which rows have no linked columns."},{"id":"c4","text":"When describePlace describes a coverage lens, it shall apply sight so that only the rows and columns the viewer may see are described."},{"id":"c5","text":"When describePlace describes the org app's Strengths place, it shall say \"Ryan: SEO (Ryan SEO, level 3)\" and \"Val: none\" and name the columns."}]
tags:
  - "graview-cloud"
  - "FR-112"
  - "chat-authored"
source: "Graview Cloud, 2026-10-06 (handoff: building En Dash Org through Claude, on 0.1.12)"
priority: "high"
---

describePlace on a coverage lens said only 'A coverage of 2 people' and the row names.
