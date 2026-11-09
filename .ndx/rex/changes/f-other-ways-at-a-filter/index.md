---
id: "e34672f6-6ef2-462f-a3c9-a1ce14b5bf42"
type: "change"
title: "Other ways to show a list do not offer what a filter in the address would not draw"
slug: "f-other-ways-at-a-filter"
intent: "Left from PR #535. At `?filter=` on a kept board, keeping an option that flows draws the list rather than that option, because a flowing place cannot honor `filter`, and the preview shows all records rather than the filtered ones, so the bar's \"now shows as\" is not what the person then sees at that address."
acceptanceCriteria:
  - "At an address with a filter, an option that cannot honor the filter is withheld from the switch, or the preview and the kept page agree (test)"
  - "A browser harness claim opens a filtered address on a kept board and holds it"
touches:
  - "15e519fe-9ad9-4498-904f-5cd2f77ec15c"
priority: "low"
tags:
  - "graview"
  - "pages"
  - "hq:feature:f-other-ways-at-a-filter"
source: "Graview HQ feature:f-other-ways-at-a-filter"
---
