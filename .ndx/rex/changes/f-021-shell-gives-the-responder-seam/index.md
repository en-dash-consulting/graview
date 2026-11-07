---
id: "2498e5be-0b44-4edf-9684-6e0d2c9bc65a"
type: "change"
title: "F-021 · Shell gives the Responder seam no hole to come through"
slug: "f-021-shell-gives-the-responder-seam"
intent: "Found building Groundskeeper (../groundskeeper-graview), a ten-kind product on Graview. Full write-up with measurements: groundskeeper-graview/docs/graview-feedback.md, F-021. graphResponder exists, the chat panel exists, and Shell's chat prop is a boolean, so an app cannot hand the panel its own responder without rebuilding the shell."
acceptanceCriteria:
  - "Shell accepts respond?: Responder<S> (or chat: { respond }) and passes it to the panel"
  - "A test mounts Shell with a responder and asserts the panel answers through it"
touches:
  - "63bcc889-264e-4b44-bc30-5d1e0ed7300b"
priority: "high"
tags:
  - "groundskeeper-feedback"
  - "@graview/primitives"
source: "groundskeeper-graview/docs/graview-feedback.md"
---
