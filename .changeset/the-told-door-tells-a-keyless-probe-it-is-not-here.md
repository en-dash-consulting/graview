---
"@graview/ship": patch
---

The dev server's told door (Roadmap f-menu-learns) tells a page asking without the door's key whether it keeps tellings that it does not — `{ available: false }`, as the model's door answers such a probe — rather than a 403, which a driven browser's console said as an error and which failed `verify-renderer`'s claim that a page without the GPU path says nothing. A write without the key is still refused. Test: `the-told-door-tells-a-keyless-probe-it-is-not-here`.

Compatibility: ops and primitives — unchanged. Stored formats — unchanged. The wire — the dev server's `/__graview/told` answers a keyless GET `{ available: false }` (200) where it answered 403; nothing a build serves changes. The declaration and check finding codes — unchanged. Derived tool names and input schemas — unchanged.

What Graview Cloud does: nothing; its own told store is behind its own session.
