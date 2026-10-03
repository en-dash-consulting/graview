---
"@graview/core": patch
"@graview/ship": patch
---

Core says its own version, and a rule that cannot answer says so in a field. `FRAMEWORK_VERSION` is the version every `@graview/*` package shares, written by `pnpm version-packages` after `changeset version`. A violation carries `status`: `violated` when a rule judged, `could-not-judge` when it threw, `over-budget` when it threw the new `RuleBudgetError`. A rule that throws is now one finding about its subject instead of an exception that took every other rule's standing down with it. `health()` counts `couldNotJudge` and `overBudget` apart (FR-29).

Compatibility: additive — `Violation.status`, `HealthReport.couldNotJudge` and `.overBudget` are new fields; a rule that throws no longer makes `evaluate` or `Store.apply` throw, it yields a violation instead.
