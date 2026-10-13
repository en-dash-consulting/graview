---
"@graview/core": patch
---

A rule that is a function says it reads the clock without a cast (the ninth walk, W-190). The graview-invariant skill says such a rule "says `readsTheClock: true`", and FR-176 added the key to `InvariantDefinition` but to none of the ways a rule is declared: `bindSchema(schema).defineInvariant`, `defineGraphInvariant` and `defineInvariant` refused it, so the line the skill writes did not compile. All three take `readsTheClock` now.

Compatibility: additive — `defineInvariant`'s, `bindSchema().defineInvariant`'s and `defineGraphInvariant`'s specs take the optional `readsTheClock` that `InvariantDefinition` already had.
