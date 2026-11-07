---
id: "b4fc810d-bdfc-470d-bf6f-d95480fa34d6"
type: "change"
title: "F-023 · The scene draws past the right edge at 390px"
slug: "f-023-the-scene-draws-past-the-right"
intent: "Found building Groundskeeper (../groundskeeper-graview), a ten-kind product on Graview. Full write-up with measurements: groundskeeper-graview/docs/graview-feedback.md, F-023. At 390x844 the scene has an element ending at 600px; the regimen is 210px off-screen. Whether the answer is a scroll container, scale-to-fit, or the bar saying 'this is a desk view, here is the routed face' is a decision the framework should make deliberately."
acceptanceCriteria:
  - "At 390px wide no scene element extends past the viewport, or the scene says plainly that it is a desk view and offers the routed face"
  - "The decision is written in the graview-pages or graview-ship skill"
  - "Measured by a harness at 390px on an app with seven or more kinds"
touches:
  - "4382c67b-1055-4623-b8fb-62b9be3fa330"
priority: "high"
tags:
  - "groundskeeper-feedback"
  - "@graview/react"
source: "groundskeeper-graview/docs/graview-feedback.md"
---
