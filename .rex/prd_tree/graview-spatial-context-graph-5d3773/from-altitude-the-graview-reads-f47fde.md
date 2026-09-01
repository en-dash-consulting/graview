---
id: "f47fde4c-84d9-4f81-a0d7-6ec608cca2c3"
level: "feature"
title: "From altitude the Graview reads as a city, not scattered slips"
status: "pending"
priority: "high"
tags:
  - "ux"
  - "scene"
  - "overview"
  - "layout"
source: "UX pass over docs/survey 2026-08-31; user: the graview should have an isometric-city, zooming-out feel, and it doesn't"
acceptanceCriteria:
  - "The overview ring carries a depth gradient in the existing affine vocabulary: kinds on the far side of the ring sit smaller, hazier and further back; kinds on the near side come toward the viewer — the same arc language the in-stack strip already speaks (today ring() emits depth = 1, flat, for every card)"
  - "The live centre view visibly outranks the kind cards — it reads as the tallest structure, not a peer stamp; overview fill rises from 16-24% toward 40% at 1560x940 without crowding"
  - "No kind card overlaps another and none is occluded by the centre view in any app's overview state"
  - "Connectors anchor at card edges facing their far endpoint, route around rather than under the centre view, and none ends in open ground"
  - "Hovering a relation in the legend (or a connector) brightens that relation's lines and dims the rest — from up there the lines are the content, so they must be individually readable"
  - "The self-relation loop (the unexplained dashed circle in todo and proposal) either carries a label that says what it is or is drawn as a compact badge on its kind card"
  - "Every existing harness stays green: survey, audit, navigation, moving, shrunk, a11y, plus pnpm test / typecheck / check"
description: "The zoomed-out Graview was meant to feel like rising over a city — the interface you were working in stays live in the middle, and the kinds arrange around it like districts, with the relations readable as roads. What renders today is flat, weightless and mostly void: every kind is a same-weight axis-aligned rectangle at depth 1, the centre view shrinks to a peer-ranked stamp, splines anchor at corners, converge to points and end mid-air, and 76-84% of the scene is empty ground (fill 16-24 across all four apps).\n\nThe framework's own language already has everything needed and explicitly rejects perspective (plane.ts: affine or per-plane uniform, nothing per-element, nothing perspective). Isometric projection is technically affine, but the honest move is the one the in-stack arc already makes: depth from position (far side higher, smaller, hazier; near side toward you), elevation from shadow, and the centre view outranking everything because it is live and at full fidelity. The ring has the geometry (it is an ellipse with a near and a far side) — it just never told depth about it.\n\nSpecific defects folded in: proposal RULES half-buried behind the centre stamp; the household example REASONS/TRIGGERS overlap on the ring; the dashed self-relation circle floats unlabelled; the legend is inert — it counts relations but cannot pick one out of the picture."
---
