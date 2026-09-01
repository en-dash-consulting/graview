---
"@graview/core": patch
"@graview/tools": patch
"@graview/primitives": patch
---

Code-review fixes. `edge-without-severer` is suppressed only when EVERY
kind declaring the edge name says appendOnly — one kind's suppression no
longer hides another's makeable-but-never-unmakeable relation. The usage
boost stops counting acts the person took back: an op undone by a later op
carries no weight (the old undo guard was dead code — undo ops have no
mutation — while the retracted originals kept theirs). The action filter's
Enter never runs a destructive sole survivor and shows it no ↵ promise;
an empty-query Escape blurs the field so the product-wide back-out works
on the next press. And the person's pins now reach the agent seats: a
tool runtime's `derive` option can be a function, read fresh per call, so
the strip, the pointer menu, the chat and the agent seat never disagree
about the same acts.
