---
"@graview/core": patch
---

`capabilities().shipped` names the publishing a host draws on the framework's lifecycle (FR-205). Graview Cloud filed its publishing UI — the mode setting, the in-app banner with Publish and See what readers see, publish from chats — under FR-205; the seams it stands on (`publishing` in a declaration, `publish`, the served view, `?as=published`) shipped in 0.1.50, and a host asking what this build ships now finds the id it filed them under.

Compatibility: ops and primitives, stored formats, the wire, the declaration and check finding codes, derived tool names and input schemas, the JavaScript API, the theme and the embed — unchanged; `capabilities().shipped` gains FR-205.
