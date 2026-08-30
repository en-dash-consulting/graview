---
id: "9a35ab31-d28d-4373-bfac-9703e722923a"
level: "task"
title: "Capture and composite DOM panels at plane depth"
status: "pending"
priority: "critical"
tags:
  - "spike"
  - "vgpu"
  - "html-in-canvas"
acceptanceCriteria:
  - "Three panels render at three visibly distinct depths with per-plane scale and blur"
  - "The captured texture is wrapped as an external-ownership vgpu Texture with no copy"
  - "All platform API calls sit behind a single wrapper module"
description: "Get pixels on screen. Three DOM panels as descendants of a `<canvas layoutsubtree>`, captured into WebGPU textures and drawn as quads at three plane depths through vgpu, with per-plane scale and blur.\n\nChrome Canary (or Brave, Chromium 147+) with the `canvas-draw-element` flag. Load the installed vgpu skill (.claude/skills/vgpu) before writing GPU code.\n\nKey seams to exercise: `drawElementImageToTexture` on GPUQueue — note the WICG README also calls it `copyElementImageToTexture`, so wrap it behind one module and expect churn. Wrap the resulting GPUTexture as a vgpu Texture with `ownership: \"external\"` to avoid a copy. Use `Device.gpu` and `Device.queue` for the raw handles, and vgpu/scene's orthographic camera.\n\nNo framework code — this is validation, and throwaway is acceptable."
---
