---
"@graview/studio": patch
---

The studio keeps a rule's repair that names an act the framework derives. `edit-<kind>` and `remove-<kind>` have no act node for a `repairs` edge to point at, so the round trip dropped them — a rule repaired through the derived edit came back with no repairs, in the files and in the applied app. They are kept on the rule by name (`derivedRepairs`) and written back with the rest.
