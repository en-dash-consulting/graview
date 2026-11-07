---
id: "aebd9f0e-60c2-4bb5-b7d0-5a54c6fcf171"
type: "change"
title: "F-030 · The scene's URL carries the focus and not the view"
slug: "f-030-the-scene-s-url-carries-the"
intent: "Found building Groundskeeper (../groundskeeper-graview), a ten-kind product on Graview. Full write-up with measurements: groundskeeper-graview/docs/graview-feedback.md, F-030. useUrlSync writes focus, zoom and selection to the fragment; which group view is showing is not in it, so a page can only say 'open the scene and press The grounds'."
acceptanceCriteria:
  - "The active group view is written to the fragment alongside the focus and adopted on first load"
  - "sceneHref + '#view=<lens>' opens the scene on that view"
  - "Back and forward honour view changes without phantom stops"
touches:
  - "4382c67b-1055-4623-b8fb-62b9be3fa330"
priority: "medium"
tags:
  - "groundskeeper-feedback"
  - "@graview/react"
source: "groundskeeper-graview/docs/graview-feedback.md"
---
