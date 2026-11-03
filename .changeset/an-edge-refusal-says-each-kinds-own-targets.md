---
"@graview/core": patch
---

An edge refused between two kinds no longer contradicts itself. On an app whose `about` relation two kinds declare — a brief about features and areas, a request about areas alone — the act `about-area` linking a request to a feature was refused with "Edge "about" is not declared from request to feature — Declared: brief|request -> feature|area", the union of every declaring kind's targets, which allows the pair it refused. The refusal says each declaring kind's own targets, the refused kind's first: "Declared: request -> area; brief -> feature|area". And a document's act that connects from its subject asks for the far end the subject's own kinds reach, so an act on requests alone offers areas, never a feature its store would refuse. Test: `an-edge-check-allows-what-its-declared-unions-allow`.

Compatibility: ops and primitives — unchanged. Stored formats — unchanged. The wire — unchanged. The declaration and check finding codes — unchanged; a compiled act's record argument may name fewer kinds, those its subject's own declaration reaches. Derived tool names and input schemas — a declared act's tool schema for such an argument names those kinds.

What Graview Cloud does: nothing; an agent asking `about-area` of a request is offered the areas it can be about.
