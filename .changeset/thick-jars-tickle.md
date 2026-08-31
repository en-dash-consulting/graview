---
"@graview/core": patch
"@graview/render": patch
"@graview/primitives": patch
"@graview/react": patch
"@graview/tools": patch
---

Permissions, brands and a publishable shape.

- A `Principal` is an `Author` with roles, and a `Policy` of grants is enforced
  at the store — including on undo, which was a complete bypass.
- A `Brand` declares name, logo, typography and both schemes, and
  `graview check` measures every text pair against WCAG AA.
- `@graview/render` splits its WebGPU surface behind `@graview/render/gpu`, so
  the main entry no longer requires consumers to install `@webgpu/types`.
