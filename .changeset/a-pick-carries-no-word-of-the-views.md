---
"@graview/guest": patch
"@graview/skills": patch
---

A person's pick in a worker view no longer carries the view's own words into an act (FR-92). With sights on, a press took a radio or a select the person had chosen as theirs, value and all. But a radio's value and a select's options are written by the view. A view could draw a radio labelled "This package is right" whose value was the internal cost Erin may see, and her pick and press wrote that cost into the summary Lin reads. That is a whole string per press, not the one bit a record choice carries. Now a picked radio or select is sent only when its value is one the app itself declares for the argument, an enum's option or a literal's value, or the id of a record the view was shown. Anything else is refused `untyped`, with a sentence saying it was a choice among the view's own words. A checkbox still carries only whether it is checked, and typed words are judged as before.

A unit test refuses the radio and the select that carry the cost and applies a pick among the standings the app declares. `guest-sandbox --transport=writes` gains a view with the radio. Before the fix Lin read "costs 18500" in Chromium, WebKit and Firefox, and now nothing is written in any of them. The `graview-worker-view` skill says what a pick may carry.

Compatibility: unchanged. The refusal is the existing `untyped`, and no op, stored format, wire message, check code or tool schema moves.
