---
"@graview/core": patch
"@graview/studio": patch
"@graview/ship": patch
---

A rule can say what must hold in words the framework judges: `quote != null`, `count(in('fills') where status == 'booked') <= 1`. `@graview/core/document` is a new entry, and its rule language has these properties:
- Fields and one-edge hops, `out`/`in`/`all` sets with `where`, and a closed set of functions.
- `null` that propagates.
- No regular expressions, loops or user functions.
- A step budget on every evaluation.

`expressionRule(name, { over, require, when?, says?, repairs? })` makes the invariant the engine runs. A judgement that runs out of budget is `over-budget` (FR-29), and any other mistake is `could-not-judge`; neither is a hang.

A rule in the studio now takes its judgement as a field. The studio judges it after apply, writes it into the checkout as `expressionRule(…)` with its import instead of a stub to fill in, and reads it back from a declaration whose invariant carries `judgement`. The seedbed rehearsal proves this end to end (FR-07).

Compatibility: the declaration — additive: `InvariantDefinition.judgement` and a studio rule's `require`/`when`/`says` are optional; a rule without one is judged as before. `@graview/core/document` is a new entry point.
