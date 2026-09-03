---
id: "5d3773c0-3751-4007-839b-e07e9b9b4faa"
level: "epic"
title: "Graview — spatial context-graph framework"
status: "completed"
priority: "high"
tags:
  - "framework"
  - "architecture"
  - "webgpu"
  - "html-in-canvas"
  - "context-graph"
source: "Session planning — architecture agreed 2026-08-29"
startedAt: "2026-08-30T04:55:36.895Z"
completedAt: "2026-09-03T21:20:40.931Z"
endedAt: "2026-09-03T21:20:40.931Z"
acceptanceCriteria:
  - "The household example's week calendar and People relation render as one spatial scene, editable at plane 0"
  - "Clicks, focus and screen-reader access resolve correctly against nodes drawn at depth"
  - "A repair suggestion surfaces from a node selection that nobody wrote a rule to produce"
  - "An agent edit via MCP renders the same diff a human edit would, with nodes highlighted across planes"
  - "A second node kind can be added without touching framework code"
  - "Core, layout and tools packages run headlessly in CI with no browser flag and no GPU"
description: "A framework for building applications where a typed context graph is the interface rather than the backing store. Node kinds declare their own fields, edges, views, mutations and invariants in a single declaration; the framework derives spatial layout, legal actions, agent tool schemas and accessibility labels from it.\n\nRendering: ordinary DOM views live as descendants of a `layoutsubtree` canvas, are captured into WebGPU textures via the HTML-in-Canvas API, and are composited as textured quads at discrete depth planes through vgpu. `updateElementGeometry` reports each drawn position back to the browser so hit-testing, focus, screen readers and find-in-page resolve against the drawn pixels — the zoomed-out scene stays fully interactive and accessible.\n\nNavigation: discrete z-planes with the camera locked to one axis (focus / relations / context). Every stop is a URL, so the back button returns exactly. Layout is a pure function of (focus, relation, graph) overlaid with user pins, making every transition interpolable.\n\nEditing: mutations are typed graph operations, not UI gestures. One declaration generates the AI tool surface, the direct-manipulation affordances, and the invariant checks. Actions are DERIVED from the graph — selecting nodes surfaces legal mutations, invariant repairs and structural observations without anyone specifying them in advance. An LLM is one optional affordance provider, not the mechanism.\n\nHistory: the graph is a fold over an append-only operation log. Every op carries author, batch, intent, its inverse, and the set of nodes it read — which makes selective undo (\"drop the agent's turn, keep my edits\") a checkable dependency condition rather than a stack pop.\n\nArchitecture: framework-agnostic core in plain TypeScript (@graview/core, /layout, /tools) with a React binding (@graview/react); only @graview/render depends on the browser and GPU. Reference app: an existing household-calendar product, ported onto the framework as the acceptance test.\n\nDISTRIBUTION: private for now, open source possible later. Design the public API as though it will be published — clean seams, honest boundaries — but break it freely while nobody depends on it, and do not spend effort on backward compatibility yet.\n\nORDERING: Platform capability validation and Graph core are both unblocked and deliberately NOT dependent on each other — graph core is headless and survives intact if the platform answers go badly. Platform validation carries higher priority because it gates six of the eight features and holds the question that could invalidate the spatial model.\n\nFull architecture plan: https://claude.ai/code/artifact/768d0685-5880-4509-bc1a-ff1b7d908c55"
lastModified: "2026-09-03T21:20:40.941Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Children

| Title | Status |
|-------|--------|
| [Direct manipulation: act in place, travel deliberately](./direct-manipulation-act-in-place/index.md) | completed |
| [From altitude the Graview reads as a city, not scattered slips](./from-altitude-the-graview-reads-as-a/index.md) | completed |
| [Graph core — @graview/core](./graph-core-graview-core/index.md) | completed |
| [Platform capability validation](./platform-capability-validation/index.md) | completed |
| [The constellation: the graph seen from outside, and jacking in from it](./the-constellation-the-graph-seen-from/index.md) | completed |
| [A field you could set at creation, you can change: derived edits, RBAC-scoped](./a-field-you-could-set-at-creation-you.md) | completed |
| [A relation you can make but never unmake: edge symmetry, checked and offered](./a-relation-you-can-make-but-never.md) | completed |
| [An empty app is an onboarding: the blank-graph example](./an-empty-app-is-an-onboarding-the.md) | completed |
| [Derived affordances and agent tools — @graview/tools](./derived-affordances-and-agent-tools.md) | completed |
| [Descending with an open district scattered the shelf](./descending-with-an-open-district.md) | completed |
| [Layout and plane model — @graview/layout](./layout-and-plane-model-graview-layout.md) | completed |
| [Modules: named parts of a declaration a workspace can turn on and off](./modules-named-parts-of-a-declaration-a.md) | completed |
| [Quick-view relations: one-click emphasis chips for the people behind a view](./quick-view-relations-one-click.md) | completed |
| [React binding — @graview/react](./react-binding-graview-react.md) | completed |
| [Relevance is a horizon, not a delete: lifecycle, archival, and the sync flood](./relevance-is-a-horizon-not-a-delete.md) | completed |
| [Selection is part of the stop: URL-addressable, restored by back/forward](./selection-is-part-of-the-stop-url.md) | completed |
| [Spatial renderer — @graview/render](./spatial-renderer-graview-render.md) | completed |
| [The DOM path is a citizen of every browser](./the-dom-path-is-a-citizen-of-every.md) | completed |
| [The focused view can take the room it needs](./the-focused-view-can-take-the-room-it.md) | completed |
| [The graph also wears a traditional face: a routed webapp derived from the same declaration](./the-graph-also-wears-a-traditional.md) | completed |
| [The graview button toggles — 'Graview' up, 'Focus' down — and its mark morphs to say so](./the-graview-button-toggles-graview-up.md) | completed |
| [The lines are editable: relations as first-class selectable, modifiable things](./the-lines-are-editable-relations-as.md) | completed |
| [The menu scales: search, pins, and what you actually use](./the-menu-scales-search-pins-and-what.md) | completed |
| [The pages face reads like a product's own site, not a back office](./the-pages-face-reads-like-a-product-s.md) | completed |
| [The sample apps remember: a browser adapter for ship's openStore](./the-sample-apps-remember-a-browser.md) | completed |
| [Theming and look-and-feel: a declarative customization API a skill can drive](./theming-and-look-and-feel-a.md) | completed |
| [View primitives and the timeline lens](./view-primitives-and-the-timeline-lens.md) | completed |
