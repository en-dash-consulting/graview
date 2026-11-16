---
"@graview/core": patch
"@graview/tools": patch
---

Security and reliability fixes. A declared act may no longer use a name the framework reserves for an act of its own: `graview check`, `compileDocument` and an edit that adds such an act refuse it (`binding-act-taken`).

Compatibility: the look — unchanged. The JavaScript API — unchanged in shape. Ops and primitives — unchanged. Stored formats — unchanged. The wire — unchanged. The declaration and check finding codes — no new code; `binding-act-taken` is now said by an edit too, and its sentence reads differently. Derived tool names and input schemas — unchanged, save that a declared act under a reserved name is not offered as a tool.
