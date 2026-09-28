---
id: "aeae3ab3-3959-4f0b-8358-49b42f68df2e"
level: "task"
title: "The pages list page and the kind's default picture arrange through the shared module, with one control row"
status: "pending"
priority: "high"
acceptanceCriteria:
  - "The list page reads sort, filter and group from its search through the shared module; ?by=<edge> and ?<edge>=<id> still land arranged (rewritten or accepted as aliases) so every existing link works"
  - "ArrangeBar in @graview/primitives draws Sort by, Group by and filter chips from arrangeable(), writes the arrangement back through a callback, and is the one control row every surface uses"
  - "The list page adds sort and field filters; a grouped page reads as sections with counts and an empty group says so"
  - "The kind's default list picture in the scene draws the same bar at full fidelity and carries the arrangement in in.sort/in.filter/in.group"
  - "verify-pages holds the claim that an arranged list is a link that lands arranged; the pages tests cover the aliases"
blockedBy:
  - "db4e121f-04f5-4967-b513-89a4e645977c"
description: "Replace the list page's own ?by= and relation narrowing with the shared arrangement under the shared keys (sort, filter, group in the page's search), keeping every link that worked — a record's 'all the tasks on this list' still lands narrowed — and adding sort and field filters. One ArrangeBar component in @graview/primitives draws Sort by, Group by and the filter chips from arrangeable(), and is what every surface that arranges uses. The kind's default list picture in the scene takes the same bar at full fidelity. A grouped page reads as sections with counts; an empty group says so."
lastModified: "2026-09-28T20:26:35.053Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
