---
id: "7cae5029-29ee-4695-804c-e5096c0bbabe"
level: "task"
title: "0.1.39 · FR-191: A view saves a field as the person types, and hears that it saved"
status: "pending"
priority: "high"
tags:
  - "roadmap"
  - "graview-cloud"
  - "0.1.39"
source: "ndx-capture"
acceptanceCriteria:
  - "a field with data-save=\"input\" (and data-debounce, default sensible) inside a fieldset data-record with a data-act runs the act on input, debounced, collecting the fields as on a press; the script never holds values; sight and grants unchanged"
  - "the view hears the result: graview.on(\"acted\", …) with the act's outcome (or the result in onProps), so it can show Saving… / Saved"
  - "a call-sheet fixture view saves notes without a button and shows Saved; the graview-worker-view skill teaches it; tests fail first"
description: "Roadmap f-view-save-as-typed (FR-191, next), from req-autosave-from-views (Nick, Farm Bureau POM Workshop's call sheet)."
lastModified: "2026-10-19T20:00:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
