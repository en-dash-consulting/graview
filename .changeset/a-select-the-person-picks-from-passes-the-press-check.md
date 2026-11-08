---
"@graview/guest": patch
"@graview/skills": patch
---

A dropdown that saves when it is changed passes the press check (Roadmap f-view-authoring-friction-2026-11). A fact check drawn as `<select name="factCheck" data-prefill="factCheck" data-act="set-fact-check" data-save="change">` was refused by `graview view check`, `propose_view` and Better UI's checks: the option it showed counted as filled in by the view, not typed. But a select that saves on `change` is only ever saved by a person's pick, and the pick is theirs, as the page's host already takes it. The check now judges it the way a person uses it: another of its options picked (one that is not disabled and says something), or the one it shows where it has no other. The option the view showed, re-sent unchanged, is no press anybody makes and is not judged. A pick the app does not declare is refused as before, as is a Save whose select the person never picked from, and a text field the view wrote words into and the person never touched. The check no longer types its sample words into a select in a form it fills in, and a select's finding names it by its label, not its options' words. The graview-view-forms skill says it beside a select's pick.

Tests: `a-select-the-person-picks-from-passes-the-press-check` (guest) passes the fact check on a record with no value and one with a value, a select with one option re-sent as it stands, and still refuses a pick no enum declares, a Save over an untouched select showing a value the record does not hold, and a text field the view filled.

Compatibility: ops and primitives — unchanged. Stored formats — unchanged. The wire — unchanged. The declaration and check finding codes — unchanged. Derived tool names and input schemas — unchanged.
