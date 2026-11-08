---
id: "85fdaf73-cb53-4a27-bc35-ab0d6cc93df1"
type: "capability"
title: "The places list renders once as it opens (FR-158)"
slug: "the-places-list-renders-once-as-it"
statement: "Opening the More list of the places bar renders the list once, already ranked, so an entry a person is pressing is never replaced in the document."
criteria: [{"id":"c1","text":"When a person opens More, the places bar shall render the list of places once, already ranked."},{"id":"c2","text":"While More stays open, the places bar shall keep the nodes of its entries in the document without replacing them."},{"id":"c3","text":"When a press lands on an entry held from before More opened, the places bar shall deliver it to an entry still attached to the document."}]
tags:
  - "graview-cloud"
  - "FR-158"
  - "bar"
  - "places"
source: "Graview Cloud, 2026-10-10 (the framework brief after 0.1.20, ../graview-cloud/docs/framework-brief-0.1.21.md)"
priority: "high"
resolution: "Fixed on bar/places-once-and-who-is-here: while the list is open its places stay as they stood when it opened, every entry the element it was; verify-chrome-quiet's anEntryHeldFromBeforeTheListOpenedIsTheOnePressedAfter holds an entry from before the open and presses it at once after, in three engines."
---

The 0.1.20 bar ranks places and folds the rest into More; opening More rendered the list, then rendered it again with the ranking, so a press between the two landed on a node no longer in the document (Playwright: element is not attached; on a slow phone a tap does nothing or hits the entry that moved there).
