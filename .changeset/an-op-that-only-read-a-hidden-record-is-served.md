---
"@graview/core": patch
---

An op is no longer withheld from a seat only because it read a hidden record. Graview Cloud counted 659 ops in 1,000 worlds withheld while every primitive touched records the seat sees: their `reads` named a record it may not see. Such an op is now served whole — its author, its sentence, its call, its primitives — with `reads` and `writes` trimmed of what the seat may not see. A call that names a hidden record still withholds the op, because an act's sentence is made from its call ("Compare with Freya Davies"), as does a sentence, author or inverse that names one. A patch to a record served with a field cleared, which wrote only fields that were not cleared, is now served as written rather than withheld.

Compatibility: the wire and live protocols — widening within FR-55's rule, no field added or removed. A seat now receives, as ordinary ops, ops it was sent withheld only for what they read or wrote — with those trimmed — and patches to a record it is served with a field cleared that left that field alone. Every op still names no record the seat may not see, and the served log still folds to the served snapshot.
