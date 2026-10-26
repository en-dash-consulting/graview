---
"@graview/guest": patch
---

A sight that keeps fields from everybody no longer counts as total sight for a worker view's writes (FR-92). `sightIsTotal` counted a kind as seen whole by everybody whenever a `roles: "*"` sight named it, without looking at its `hide` or `fields`, so in an app where everybody sees every offer but not its cost, and staff see the cost through a second sight, a view running for a staff member could take the cost from its props and write it, from its own code with no press, into a summary a client reads. Now a sight with `hide` or a `fields` list shows a kind in part and does not count, so the view's own acts fall back to a press the host saw (or a drop's files). `a-worker-views-writes-cannot-leak` holds it with an everybody sight that hides the cost and one that lists every field but the cost: the app's sight is not total, and the view's act carrying the cost is refused `press-only`.

Compatibility: ops and primitives, stored formats, the wire, the declaration and check finding codes, derived tool names and input schemas — unchanged. A worker view in an app whose everybody sight keeps fields now acts from a press, as one in any app whose sight is not total does.
