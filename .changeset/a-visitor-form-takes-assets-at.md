---
"@graview/embed": patch
---

`@graview/embed/form` takes `assetsAt`, as every other mount has since 0.1.64 (Roadmap f-brand-marks-under-app-base): a path under `/graview/assets/` that the visitor's form draws is asked for at the host's `assetsAt(path)`, so a host serving each app under a base answers `base + path`. Test: `a-visitor-form-draws-the-apps-images-where-the-host-serves-them`.

Compatibility: ops and primitives — unchanged. Stored formats — unchanged. The wire — unchanged. The declaration and check finding codes — unchanged. Derived tool names and input schemas — unchanged.

What Graview Cloud does: pass the same `assetsAt` it passes the other mounts when it mounts a form.
