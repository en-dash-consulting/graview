---
id: "a06aa246-782b-4f85-a65c-cfff749e9f35"
level: "feature"
title: "React binding — @graview/react"
status: "completed"
priority: "medium"
tags:
  - "react"
  - "binding"
  - "ui"
blockedBy:
  - "e0dd64de-6d75-466c-8093-39d411aa529e"
source: "Session planning — architecture"
startedAt: "2026-08-30T04:39:25.521Z"
completedAt: "2026-08-30T04:39:25.521Z"
endedAt: "2026-08-30T04:39:25.521Z"
resolutionType: "code-change"
resolutionDetail: "@graview/react: views are ordinary React components with no scene-specific API; <Scene> renders them as immediate children of the layoutsubtree canvas (asserted, since the platform rejects deeper descendants); selection lives in the provider so scene and affordance surface share it; jack-in renders the SAME component with mode=\"fullscreen\" and full fidelity, and the two-mode contract is tested by rendering both. Core, layout and tools stay framework-agnostic. Bonus: a DOM renderer path using affine CSS matrix3d, so the scene works without WebGPU. 12 tests."
acceptanceCriteria:
  - "Views are ordinary React components with no scene-specific API"
  - "The same view renders correctly both captured in-scene and jacked-in fullscreen"
  - "Selection state is shared between the scene and the affordance surface"
  - "The binding stays thin enough that core, layout and tools remain framework-agnostic"
description: "The only UI-framework binding, deliberately thin so a second one stays cheap. Hooks, a `<Scene>` component, view registration, and selection state.\n\nViews are ordinary React living as descendants of the `layoutsubtree` canvas — authors write normal components, not a bespoke scene DSL. That is the whole reason the capture approach is worth its cost.\n\nIncludes \"jack in\": a fullscreen mode that lifts one view out of the spatial scene into a conventional full-page layout. Established as a FAMILIARITY affordance rather than an interactivity escape hatch — because geometry sync keeps the in-scene view fully interactive, jacking in is a comfort for a novel interface, not a requirement to get work done.\n\nEvery view must render correctly in both modes: captured-into-canvas and live-DOM-fullscreen. That two-mode contract is the central constraint on the view authoring API."
---
