---
id: "0fe6fd75-6f69-4eed-9303-d29f01bfcf42"
type: "capability"
title: "A list over a relation several kinds declare sorts by a choice field of the kinds it reaches"
slug: "a-list-over-a-relation-several-kinds"
statement: "A list over a relation that several kinds declare, such as in('under'), can be sorted by a choice field with direction choices when every kind the list reaches has that field."
criteria: [{"id":"c1","text":"When a sorted list walks a relation that several kinds declare, the checker shall judge the sort against the kinds the walk reaches from the list's own kind."},{"id":"c2","text":"When a kind that declares the relation is not reached from the list's own kind, the checker shall not require that kind to have the sort field."},{"id":"c3","text":"When every kind the walk reaches has the choice field with direction choices, the checker shall accept a list sorted by that field."}]
source: "n-dx-graview"
resolution: "Done in #205: a list over in('<edge>') is judged against the kinds whose relation leads to the walk's start, not every kind that declares it."
---

A sorted list over in('under') cannot sort by a choice field with direction choices unless every kind that declares under has that field, even when the list only ever reaches tasks and changes. The checker should judge the sort against the kinds the walk reaches from the list's own kind, not every declaring kind. Surfaced by n-dx-graview (views.change.page).
