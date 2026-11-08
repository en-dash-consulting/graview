---
id: "1fbb4a88-d61e-4638-99c6-f19554ef3526"
type: "change"
title: "0.1.39 · FR-190: add-lens refuses an option the lens does not take"
slug: "0-1-39-fr-190-add-lens-refuses-an"
intent: "Roadmap f-lens-option-refused (FR-190, next). 0.1.38's notes said add-lens refuses an unknown option; it only warns, so a misspelled key applies and does nothing."
acceptanceCriteria:
  - "add-lens (and a declared lens through applyPatch) refuses an option key the lens kind does not take, in the finding's own words and fix, e.g. columns with colour, calendar with move"
  - "a document already carrying one still compiles with the lens-option warning; tests fail first"
touches:
  - "2da41444-ab48-4789-a445-682221257285"
priority: "high"
tags:
  - "roadmap"
  - "graview-cloud"
  - "0.1.39"
source: "ndx-capture"
---
