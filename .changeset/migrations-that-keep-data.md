---
"@graview/core": patch
"@graview/ship": patch
"@graview/studio": patch
---

Migrations keep what they can. Ship's steps gain three:
- `rename-field` moves every value to the new name.
- `rename-edge` moves every link, on every kind that declares the relation.
- `coerce-field` keeps a value wherever its meaning survives and clears, and counts, what does not:
  - text to a number when it parses;
  - a datetime to a date;
  - a word to the option it names;
  - a value to a list of one.

`countSteps` says per step how many values moved, were converted or were cleared, and how many records and links went. Whether a change breaks anything is judged by these counts, not by the kind of edit.

The studio's migration sees a field or relation it renamed or retyped as the same one, by its node, so its values move instead of being dropped and re-added. A document's `planMigration` does the same through `renamedFrom`. `graview check --document <file> --previous <file>` refuses a `renamedFrom` that names nothing in the version before (FR-22).

Compatibility: stored format — unchanged; migration steps — additive (three new steps). The declaration — `renamed-from-nothing` is a new check finding code, given only with a previous version.
