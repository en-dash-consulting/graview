---
id: "8819c5f4-ff89-43cb-b467-93df9b5fe923"
level: "feature"
title: "The walk finds kinds of bug, not instances"
status: "completed"
priority: "critical"
tags:
  - "walkthrough"
  - "quality"
  - "harness"
source: "Nick, 2026-10-01, after the sixth walk added 29 findings: \"why do we keep finding distinct issues like this between walks. what are we not solving for systemically\" — then \"yes fix this\"."
completedAt: "2026-10-01T15:29:25.000Z"
acceptanceCriteria:
  - "the rules that hold everywhere are checked on every state every harness reaches"
  - "an awkward example is run through every harness"
  - "a finding of a known class is a miss of the shared check, and the walk is done when it adds no new class"
  - "the browser harnesses gate main and the release"
description: "152 findings over six walks, and the count does not fall. Read by their own 'harness that should have caught it': the same classes recur (the keyboard on <body> eight times, machine names shown to people twelve, an act offered and refused on press nine, a width/zoom/engine miss twelve) because each fix lands with a criterion local to one component; the fixtures are tame (short unique ASCII names, one human, permitted seats, a few dozen nodes) so each new domain is the only adversarial data; tests assert presence rather than content; and the browser harnesses gate nothing (verify, site, engines, survey and audit are not in CI, so a red verdict was tolerated — W-142, W-067, W-121, the kit check). The walk changes the domain each time, so 'adds nothing' cannot be reached by walking."
lastModified: "2026-10-01T04:35:44.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Children

| Title | Status |
|-------|--------|
| [A finding names its class, and a class already known is a miss of the shared check](./a-finding-names-its-class-and-a-class.md) | completed |
| [An example built to be awkward, run through every harness](./an-example-built-to-be-awkward-run.md) | completed |
| [Every screen a harness reaches is held to the rules that hold everywhere](./every-screen-a-harness-reaches-is-held.md) | completed |
| [The browser harnesses gate what ships](./the-browser-harnesses-gate-what-ships.md) | completed |
| [The core jobs are measured every run, and their friction is the work](./the-core-jobs-are-measured-every-run.md) | completed |
