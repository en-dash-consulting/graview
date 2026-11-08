---
"@graview/core": patch
---

An undo a seat may not make of somebody else's suggestion is refused in one short sentence, in the app's own roles: "That suggestion waits for an owner or a planner to decide. You can vote on it, but not take it back." It read `Not permitted to undo "…": Not permitted: …`, which said "not permitted" twice and repeated the suggestion's own words. Where the seat may not vote either, it ends "You cannot take it back." `mayUndo` and `undo` say the same.

Tests: `an-undo-a-seat-may-not-make-is-refused-in-one-short-sentence` (core).

Compatibility: ops and primitives — unchanged. Stored formats — unchanged. The wire — unchanged; the refusal's `message` reads differently for this case. The declaration and check finding codes — unchanged. Derived tool names and input schemas — unchanged.
