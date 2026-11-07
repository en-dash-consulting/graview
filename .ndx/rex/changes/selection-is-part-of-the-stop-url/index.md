---
id: "88cfdf86-0d4f-44a5-84f7-fc6a9e317d28"
type: "change"
title: "Selection is part of the stop: URL-addressable, restored by back/forward"
slug: "selection-is-part-of-the-stop-url"
intent: "Selection lived in React component state beside the view, breaking \"every stop is a URL\" twice: back/forward restored the place but stranded the selection (the inspector kept discussing a thing from a stop already left — stale, and seemingly about other nodes), and links could name the place but not the thing. Fix: ViewState gains selection (sel URL param, sorted); withSelection helper; context derives selection from the view and setSelection writes through setView as an adjustment (replaceState — a run of clicks is not a run of history entries). Root-cause fix underneath: GraviewProvider.setView resolved functional updates against the render-time view, so two writes in one gesture (travel + select) clobbered each other — now composed functionally against previous state. Engine also dedupes identical violations (same message + nodeIds) so twin rule nodes read as one problem on every surface."
acceptanceCriteria:
  - "sel round-trips toUrl/fromUrl; empty selection leaves no key"
  - "back/forward restores the selection (and thus the inspector pane) a stop was left with — verified in verify-navigation.mjs (backRestoresTheSelection)"
  - "two setView writes in one event compose (travel+select): dblclick travel still pushes a history stop"
  - "evaluate() collapses violations identical in message and nodeIds"
  - "initialSelection folds into the view; deep links with sel open with the pane ready"
  - "all UI harnesses pass with sel treated as an adjustment of the stop (placeOf comparisons)"
touches:
  - "95eebd39-8c1a-47fc-9b58-818eecb58e85"
priority: "high"
source: "user report 2026-09-01: back/forward didn't preserve selected-item side-panel; the coaching example screenshot showed inspector talking about a stop already left (stale + unrelated alarms, duplicated rows)"
---
