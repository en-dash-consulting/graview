---
id: "6417c5e0-8830-46f2-bc5e-3f330f9ac707"
level: "feature"
title: "A view's navigate takes only a string"
status: "completed"
priority: "high"
tags:
  - "roadmap"
  - "f-view-links-framework"
source: "Follow-up to #233: review of the worker view's navigate"
startedAt: "2026-10-12T15:10:00.000Z"
completedAt: "2026-10-12T15:40:00.000Z"
endedAt: "2026-10-12T15:40:00.000Z"
acceptanceCriteria:
  - "A navigate whose to or place is no string (an object, a number) is refused without a sentence: onProblem is not called"
  - "A destination that goes nowhere is quoted to at most 80 characters, ending with an ellipsis, in the host's sentence and a headless run's problems"
  - "Every navigate, lost or refused, still counts against the flood allowance"
description: "packages/guest host/view.ts: given.onmessage handed data.to from the untrusted worker to links.go without a type check, so options.sees and the nowhere() sentence took anything the worker sent, and that sentence reaches the host's onProblem and from there Cloud's problems list at any length."
resolution: "PR_PLACEHOLDER"
lastModified: "2026-10-12T15:40:00.000Z"
---
