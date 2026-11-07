---
id: "9e6a0879-80c9-4885-ad1a-5bfaa662d5c3"
type: "change"
title: "0.1.57: A view can be renamed, and a view of many can be its kind's list page; a computed value is said as its format and rounded; a date emptied in place is cleared; a text block says how many lines it shows; worker views name their sections, choose their pictures and style a disclosure's marker."
slug: "release-0-1-57"
intent: "What 0.1.57 shipped, recorded after the release from its entry in apps/site/releases.json. The work itself was tracked on the Graview Roadmap app."
acceptanceCriteria:
  - "Renaming a view. The edit `rename-view` moves every `view:<name>` the document holds (the order, the place the app opens on, the bar) and says so; a taken name or one that is no view's name is refused."
  - "A view of many as the list page. A worker view whose manifest says `replaces: \"page\"` on `cardinality: \"many\"` is drawn on its kind's list page in place of the list, as a view of one already replaces a record's page."
  - "Computed values read well. A computed field takes `format` (`money`, `percent`, `duration`), `unit` and `hidden`; `set-format` names a computed field; the rule language has `round(x, places)`. A hidden computed value still sorts a list and feeds a view."
  - "Clearing in place. Emptying a date, a text, a number or an amount where it is shown clears it, one change that can be undone; a field a record cannot be without keeps its value and says so beside it."
  - "Text that shows more. A text block may say `lines` (1 to 12, or 0 for all of it) on a card or a row."
  - "Worker views. A section may be named by its own heading with `aria-labelledby`; a manifest's `pictures` may choose kinds or fields (`[\"circuit\"]`, `{ \"circuit\": \"photo\" }`) so the 12 MB go to what the view draws; `::-webkit-details-marker` is kept beside `summary::marker`; a home view that bleeds starts right under the bar on a phone. The worker view skill says to draw a choice by its label from `props.choices`."
shippedIn: "0.1.57"
tags:
  - "backfill"
  - "0.1.57"
source: "apps/site/releases.json"
---
