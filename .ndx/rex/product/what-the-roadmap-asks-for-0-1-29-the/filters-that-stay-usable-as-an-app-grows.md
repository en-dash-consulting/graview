---
id: "a514bee4-efa3-4bfa-af5a-77b45335d7ac"
type: "capability"
title: "Filters that stay usable as an app grows"
slug: "filters-that-stay-usable-as-an-app-grows"
statement: "The product lets a person narrow a list by choice-field chips and by typing to find records, so filtering stays short and quick as an app's records grow."
criteria: [{"id":"c1","text":"The list shall show choice fields as always-visible filter chips at the top of the list, each with a count."},{"id":"c2","text":"When a relation has more than about 8 records at its far end, the filter menu shall filter that relation by typing, offering up to 8 matches plus anything and nothing."},{"id":"c3","text":"When a relation has about 8 records or fewer at its far end, the filter menu shall list those records."},{"id":"c4","text":"The filter menu shall start each section collapsed to its heading."},{"id":"c5","text":"The filter popover shall be opaque, have a maximum height, scroll on its own and keep its search sticky."},{"id":"c6","text":"On a phone, the filter menu shall open as a sheet."},{"id":"c7","text":"While a filter is active, the list shall show it as a removable chip beside the count."},{"id":"c8","text":"The pages.<kind>.filters setting shall name what a kind's list offers to filter by."},{"id":"c9","text":"When pages.<kind>.filters is not set, the default filters shall leave out relations to kinds with many records."},{"id":"c10","text":"At a desk width, the list shall show a row's badges without cutting them off."},{"id":"c11","text":"When a count is zero, the list shall not draw it as a badge."},{"id":"c12","text":"On an app with 100 or more records of a related kind, the Filter menu shall open short, a person shall find a record in a few keystrokes, and a status filter shall take one tap."}]
tags:
  - "roadmap"
  - "f-filters-that-scale"
source: "Nick, 2026-10-13: \"do all planned items for graview core that the roadmap has laid out. capture and work them in ndx appropriately\""
priority: "high"
resolution: "A list's choice fields stand as chips with counts, what is on is a removable chip beside the count, Filter opens with every heading closed under a sticky find box (opaque, 520px at most, a sheet on a phone), a relation past eight far records is found by typing, a relation to a kind of more than forty records is left out by default and offered through its far end's choices (`became.stage`), and `pages.lists.<kind>.filters` names what a list offers (checked as `pages-filter-unknown`); a zero count is no badge. Proved by `pnpm verify growing` on a 120-feature roadmap at desk and phone in three engines."
---

On the Roadmap's Requests list, Filter opens one long menu listing every record at the far end of every relation (90+ feature names). Roadmap f-filters-that-scale.
