---
"@graview/render": patch
---

Render's README names its hit-testing as it is exported, `PointerRouter` and `hitTest`, not the `routePointer` it was renamed from. The pack inspection now fails on any README that names an export no packed package has, so a README cannot promise an API the tarball lacks (FR-15).

Compatibility: unchanged — a README and the pack inspection only.
