---
id: "0fe6fd75-6f69-4eed-9303-d29f01bfcf42"
level: "feature"
title: "A list over a relation several kinds declare sorts by a choice field of the kinds it reaches"
status: "completed"
source: "n-dx-graview"
startedAt: "2026-10-10T23:30:00.000Z"
completedAt: "2026-10-11T03:10:00.000Z"
endedAt: "2026-10-11T03:10:00.000Z"
acceptanceCriteria: []
description: "A sorted list over in('under') cannot sort by a choice field with direction choices unless every kind that declares under has that field, even when the list only ever reaches tasks and changes. The checker should judge the sort against the kinds the walk reaches from the list's own kind, not every declaring kind. Surfaced by n-dx-graview (views.change.page)."
lastModified: "2026-10-11T03:10:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
resolution: "Done in #205: a list over in('<edge>') is judged against the kinds whose relation leads to the walk's start, not every kind that declares it."
---
