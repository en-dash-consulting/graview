---
id: "2755b093-163e-463d-bc1c-e15c4477dc18"
level: "task"
title: "Embed knows what its host can keep: the studio hidden or handed to the host, and a size budget"
status: "completed"
priority: "medium"
tags:
  - "graview-cloud"
  - "FR-13"
source: "Graview Cloud build, 2026-10-02"
startedAt: "2026-10-03T05:28:00.833Z"
completedAt: "2026-10-03T05:28:00.833Z"
endedAt: "2026-10-03T05:28:00.833Z"
acceptanceCriteria:
  - "mount with studio:false shows no Studio place"
  - "mount with studio:{onApply} hands the host the applied declaration and writes nothing itself"
  - "A CI check fails when the pages-face-only bundle exceeds its budget"
description: "Mounted over a remote store in Cloud, embed still offers the Studio place, whose edits can only be written back through the dev-server door — so a hosted reader can change a declaration that will never be saved. And the whole embed (every face, the local-AI rung) bundles to 1.3 MB minified. POSITION: mount({ studio: false | onApply }) so a host hides the studio or receives the applied declaration (Cloud would turn it into a proposal), and faces/rungs load lazily with a per-face size budget checked in CI."
lastModified: "2026-10-03T05:28:00.917Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
