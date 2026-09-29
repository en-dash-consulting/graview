---
"@graview/render": patch
---

`@graview/render` no longer names `vgpu` as a peer. It never imported it: the compositor takes any WebGPU device said structurally (`{ device: { gpu: GPUDevice } }` and a surface with a `context`), so a device from `navigator.gpu`, `vgpu`, `vgpu/node` or `vgpu/mock` all fit. The peer only pinned a library the package does not call to a range (`^0.3.1`) that warned anyone on a newer one. `@webgpu/types` stays an optional peer for the `./gpu` entry's types.
