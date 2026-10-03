---
"@graview/core": patch
---

A conformance kit. `@graview/core/conformance` ships fixtures:
- declaration documents, with whether each compiles, what `graview check` says about it, and the tool every act is offered as;
- op logs, with the snapshot hash each folds to.

`conformance(build?)` runs them against this build, or against the pieces of a build a host hands it, and returns every difference by fixture id. A host learns what a new version makes differently of yesterday's data before it takes it.

The fixtures are append-only. `scripts/conformance-fixtures.mjs` only adds new ids, a lock holds the recorded ones, and a change to one is an announced difference with its version (FR-32).

Compatibility: additive — a new entry point. The fixtures record this version's tool schemas and check findings as the baseline later versions are held to.
