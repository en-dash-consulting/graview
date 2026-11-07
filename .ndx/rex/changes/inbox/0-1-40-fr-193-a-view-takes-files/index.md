---
id: "a61e0fff-0eba-44ce-916b-4b888650266a"
type: "change"
title: "0.1.40 · FR-193: A view takes files dropped on it"
slug: "0-1-40-fr-193-a-view-takes-files"
intent: "Roadmap f-views-take-a-drop (FR-193), from Nick's request on a hosted family weekend app's journey home view: drop photos and a phone video from Finder onto a day card and have moments appear there."
acceptanceCriteria:
  - "a fixture view takes three images and a video dropped on a day card as four records on that day in one undoable change"
  - "on a phone (a coarse pointer) a tap on the same element opens the file picker, its accept matching the fields' types"
  - "a view with only accepts (no drop listener) gets the default: a record of the kind per file, its file on its field, linked by data-drop-connect, in one change"
  - "graview.act(name, [args, …]) runs several as one change with one undo, and an act's argument takes a file only as the host handed it"
  - "a seat that may not make the kind is offered no drop target, so nothing is offered and then refused"
  - "the view checker (describe.ts) reports a data-drop whose kind or field is not in accepts, and the headless runner takes accepts"
  - "tests fail first; a browser harness proves the drop with a DataTransfer built in the page, and the picker with setInputFiles"
  - "a face whose files config takes nothing offers no drop and never says \"up to 0 bytes\"; an empty video field on a record whose host takes video/* shows a control to add one"
priority: "high"
tags:
  - "roadmap"
  - "graview-cloud"
  - "0.1.40"
source: "ndx-capture"
---
