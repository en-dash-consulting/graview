---
"@graview/core": patch
---

A list over a relation several kinds declare sorts by a choice field of the kinds it reaches. n-dx declares `under` on six kinds — a task under a change, a zone under a zone — and a change's page lists `in('under')` by status in its declared order. The checker held that sort, and a group, to every kind that declares `under`, so a zone, which has no status and is never under a change, refused it. A walk is now judged by the kinds it reaches from where it starts: `in('under')` on a change's page, the kinds that declare `under` to a change; `in(all('zone'), 'under')`, those that declare it to a zone. A choice field one of those kinds lacks is still refused, by name.

Compatibility: ops, stored formats, wire messages, the compiled format, check finding codes, tool names and schemas are unchanged. Changed: a list's `sort` and `group` over `in(…)` are judged against the kinds whose relation leads to the walk's start, so a document refused `list-sort` or `list-group` for a kind its list never reaches now compiles.
