---
"@graview/core": patch
"@graview/primitives": patch
---

A lens path that cannot get from its columns to its rows is a binding error, not a picture of nothing covered. `graview check` walks it off the declaration (`lens-binding-path-misses`, saying when it is only named backwards and how to name it), and the coverage throws a `CoverageBindingError` with the same sentence rather than reading every row as uncovered. `walkKinds` is exported.
