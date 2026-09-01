---
id: "e0dd64de-6d75-466c-8093-39d411aa529e"
level: "feature"
title: "Spatial renderer — @graview/render"
status: "completed"
priority: "high"
tags:
  - "render"
  - "webgpu"
  - "vgpu"
  - "html-in-canvas"
blockedBy:
  - "23d22798-65b2-4d59-80c7-8b82352aad16"
source: "Session planning — architecture"
startedAt: "2026-08-30T04:35:33.440Z"
completedAt: "2026-08-30T04:35:33.440Z"
endedAt: "2026-08-30T04:35:33.440Z"
resolutionType: "code-change"
resolutionDetail: "@graview/render: capture loop through one platform module, plane compositing with per-plane scale/blur/falloff/shadow (verified by screenshot in Chrome Canary), geometry sync for every drawn view every frame, fidelity-driven capture budget (only plane 0 is live), connector stroke derived per edge kind with a distinguishability assertion, and PointerRouter covering the platform's missing hit-test redirection. planFrame makes the whole policy layer pure data, so CI tests it with no GPU and no DOM — 26 tests. Caveat recorded honestly: receded text legibility depends on summary views, which is the primitives work, not the renderer's."
acceptanceCriteria:
  - "Views composite at plane depth with per-plane scale, blur and shadow"
  - "Geometry sync runs for every drawn node, every frame it moves"
  - "Text on receded planes is legible, via fidelity switching rather than scaling"
  - "Connector stroke treatment differs by edge kind"
  - "Capture budget holds frame rate at the target node count"
  - "Renderer snapshot tests pass in CI through vgpu/mock with no GPU present"
description: "The capture loop and the GPU scene. The ONLY package gated on experimental platform capability, and therefore the only one at risk if that capability does not land.\n\nCore loop per frame: capture dirty views via `drawElementImageToTexture` into GPU textures, wrap them as vgpu Textures with `ownership: \"external\"` (no copy), draw as textured quads at plane depth, then call `updateElementGeometry` for each so interaction and accessibility resolve against the drawn pixels.\n\nCapture budget follows the fidelity axis: only plane 0 captures live every frame; summary fidelity captures on change into a cached texture; glyph fidelity is painted in the shader with no capture at all.\n\nVisual language is atmospheric depth — crisp saturated focus plane, receding planes losing contrast, gaining blur, drifting toward the ground color, with soft directional shadow separating them. Per-plane blur and falloff are near-free in a shader and expensive in CSS, which is what justifies the GPU pipeline.\n\nTwo constraints from the mechanism rather than taste: receded text must stay LEGIBLE (which is what forces the fidelity axis — a receded calendar switches to a denser summary view rather than scaling down into mush), and connector styling carries meaning, so edge kind determines stroke treatment and `protects` never looks like `assigned-to`.\n\nUses vgpu/scene's orthographic camera — the affine-safe projection the plane model wants anyway. Snapshot-tested via vgpu/mock so CI needs no GPU.\n\nKnown constraint: DOM changes made during the `paint` event land a frame later, so drag feedback must be driven in the shader and reconciled to the DOM after the gesture settles."
---
