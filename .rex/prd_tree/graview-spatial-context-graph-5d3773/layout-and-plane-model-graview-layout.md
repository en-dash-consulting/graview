---
id: "c7aedc30-0fe8-45e2-aad3-33bd0c2e6dc7"
level: "feature"
title: "Layout and plane model — @graview/layout"
status: "completed"
priority: "high"
tags:
  - "layout"
  - "headless"
  - "navigation"
blockedBy:
  - "23d22798-65b2-4d59-80c7-8b82352aad16"
source: "Session planning — architecture"
startedAt: "2026-08-30T04:25:28.277Z"
completedAt: "2026-08-30T04:25:28.277Z"
endedAt: "2026-08-30T04:25:28.277Z"
resolutionType: "code-change"
resolutionDetail: "@graview/layout: pure function of (focus, relation, graph) + pins; stable-key ranking; aggregates expand/collapse through one code path; every stop round-trips through a URL; any two layouts interpolate with members growing out of the aggregate that stood in for them. Affine-only, per the settled platform answer. 17 tests."
acceptanceCriteria:
  - "The same graph and focus always produce identical positions"
  - "Any two view states interpolate, producing an animatable transition"
  - "Every stop is a URL and the back button returns to the exact prior view"
  - "User pins override computed positions and survive graph changes underneath"
  - "An aggregate block expands to its members and collapses back through one code path"
  - "Positions are stable across graph edits that do not concern the visible nodes"
description: "Where nodes sit in space, and how you move between depths. Headless — emits positions and transforms, renders nothing.\n\nLayout is a PURE FUNCTION of (focus, relation, graph), overlaid with user pins. Same graph, same picture — spatial memory survives, and any two states can be interpolated, so every plane transition is animatable.\n\nDiscrete z-planes with the camera locked to one axis: plane 0 focus (live DOM, editable), plane 1 relations (the entity type you asked to see, with connectors), plane 2 context (everything else, as aggregate blocks). No free orbit — every view is nameable and returnable.\n\nAggregate nodes are first-class, not a scale fallback. A \"People\" block is a legitimate view of a kind, so grouping and semantic zoom are one mechanism running in both directions: a focused calendar receding into a compressed summary and an aggregate expanding into its members are the same operation.\n\nBlocked on platform validation for the perspective-vs-affine answer, which determines what transforms layout is permitted to emit.\n\nLayout stability risk: rank by stable keys, never by mutable counts, or graph edits reshuffle positions and destroy spatial memory."
---
