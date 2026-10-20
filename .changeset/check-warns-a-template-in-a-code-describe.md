---
"@graview/core": patch
"@graview/skills": patch
---

`graview check` warns when a `describe` written in code returns a template (carried from the twelfth walk, a film society). One sentence of the walk's app said `{startsAt | datetime}` to a person, braces and all: a template is filled in only in a document's strings, and a kind's `describe` or `label`, or an act's `describe`, written in code is shown as it returns. The watch caught it on the page and the checker said nothing. Now it warns, `describe-template-in-code` at `defineNode("<kind>").describe` (or `.label`, or `defineMutation("<act>").describe`): the text of the function's strings is read for `{name}` naming a field, relation or computed value of the kind or an argument of the act, and for any `{name | filter}`, and the fix says the value in code — `momentAsRead(node.startsAt)`, `dayAsRead(…)`, or `${…}` in a template literal. The `graview-view-specs` skill says so. The studio carries the checker, so the embed with the studio handed in measures 1.9 KB more (0.2 KB gzipped) and every face 2.1 KB, and their budgets are raised by that; nothing of it is in a hosted page.

Compatibility: ops, stored formats, the wire and derived tools are unchanged; every declaration that compiled still compiles. The check finding codes gain `describe-template-in-code`, a warning about a describe or label in code whose words show braces to a person; a document's strings are not asked.
