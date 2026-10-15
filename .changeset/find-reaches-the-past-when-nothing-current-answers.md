---
"@graview/core": patch
---

Find reaches the past when nothing current answers. A search kept to the records on the horizon unless it said `is:any`, so a rescue team looking for last March's callout by its number found nothing and was told "add is:any for the past". Where the words find no current record, the past records they find are the answer, each marked past, and `searched.past` says the search looked there; where a current record answers, or the words say `is:`, the search keeps to what it was asked.

Compatibility: `search` (and every face's Find, `/search` and `search_graph`) answers a query that matches only past records with those records, marked `current: false`, where it answered with nothing.
