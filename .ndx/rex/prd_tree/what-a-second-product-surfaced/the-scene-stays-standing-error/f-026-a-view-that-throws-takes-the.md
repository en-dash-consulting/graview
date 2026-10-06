---
id: "f4093efa-8100-45ee-801f-7c2c13aaa69e"
level: "task"
title: "F-026 · A view that throws takes the whole scene down"
status: "completed"
priority: "critical"
tags:
  - "groundskeeper-feedback"
  - "@graview/react"
source: "groundskeeper-graview/docs/graview-feedback.md"
startedAt: "2026-09-14T22:34:52.994Z"
completedAt: "2026-09-14T22:34:52.994Z"
endedAt: "2026-09-14T22:34:52.994Z"
acceptanceCriteria:
  - "An error boundary per view host renders the error's message with the kind and view named, in the view's place"
  - "The bar, districts and other views stay mounted and interactive when one view throws"
  - "A test mounts a view that throws on render and asserts the scene's chrome is still present"
  - "The graview-lens skill's 'fail loudly on a bad binding' step says the failure is a panel, not the page"
description: "Found building Groundskeeper (../groundskeeper-graview), a ten-kind product on Graview. Full write-up with measurements: groundskeeper-graview/docs/graview-feedback.md, F-026. A binding error in an app-authored lens produced a black page: no bar, no districts, no way back. The scene has no error boundary around a view host."
lastModified: "2026-09-14T22:34:53.006Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
