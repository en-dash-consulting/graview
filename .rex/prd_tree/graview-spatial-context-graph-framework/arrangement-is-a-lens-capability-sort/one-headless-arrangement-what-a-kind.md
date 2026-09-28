---
id: "db4e121f-04f5-4967-b513-89a4e645977c"
level: "task"
title: "One headless arrangement: what a kind can be sorted, filtered and grouped by is derived from its declaration, and an arrangement is a string in the stop"
status: "pending"
priority: "critical"
acceptanceCriteria:
  - "arrangeable(schema, kind) offers sorts, filters and groups derived only from the declaration: fields by zod type, edges by far end, lifecycle current/past, standing flagged; each offer carries the reading of its field"
  - "arrange(nodes, arrangement, context) returns ordered groups; sort is stable and by-field, by-label or by-far-end; a filter is a conjunction; a group by date buckets by day, week or month; an unknown or malformed part is dropped, not thrown"
  - "parseArrangement / formatArrangement round-trip the one-string-per-part grammar (sort=field:dir, filter=key:value,..., group=key) and the same functions serve a lens's within and a page's search"
  - "fieldRoles.order names a kind's natural sort and is the default when nothing is asked"
  - "Unit tests hold the derivation to properties over the todo and seedbed declarations, and the grammar to round-trips"
description: "In @graview/core, no React: arrangeable(schema, kind) reads the declaration and offers the sorts (label, every string/number/boolean/enum/date field, an edge's far-end label), the filters (boolean and enum fields by value, date fields by before/after/on, an edge to a named node or to anything, lifecycle current/past, standing flagged) and the groups (enum and boolean fields, edges by far end, date fields by day/week/month), each named the way `reads` says the field reads. arrange(nodes, arrangement, { graph, definition }) returns ordered groups. The grammar is one string per part — in.sort=due:desc, in.filter=done:false,holds:today, in.group=status — parsed and formatted by core, so a lens carries it in ViewState.within and a page carries it in its search with the same words. fieldRoles.order names a kind's natural sort. A lens declares arrange: false, or per part, to decline."
lastModified: "2026-09-28T20:26:33.996Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
