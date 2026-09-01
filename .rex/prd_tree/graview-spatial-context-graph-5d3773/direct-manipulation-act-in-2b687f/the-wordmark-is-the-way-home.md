---
id: "966667b8-a22a-4da6-8779-4d9d5cfe69e2"
level: "task"
title: "The wordmark is the way home"
status: "completed"
priority: "low"
tags:
  - "ux"
  - "navigation"
source: "Nick, 2026-08-31: \"clicking the logo should reset me to the landing page like every other site\""
startedAt: "2026-09-01T03:12:21.996Z"
completedAt: "2026-09-01T03:12:21.996Z"
endedAt: "2026-09-01T03:12:21.996Z"
resolutionType: "code-change"
resolutionDetail: "Shipped in the same commit; verified in the browser (wander to a zoomed record, click the logo, land on the exact opening URL with pins preserved)."
acceptanceCriteria:
  - "Clicking the wordmark returns to the view the app opened on — focus, relation, zoom, overview and camera reset, selection cleared"
  - "Deliberately pinned cards stay pinned: going home is not tidying the desk"
  - "The control is at least 24px tall and the audit stays clean"
description: "The wordmark was an inert span. It is a button now: the provider remembers the view it mounted with (homeView) and the wordmark returns there, the way a site's logo returns to its front page. Verified: wander to a zoomed record, click the logo, land back on the exact opening URL."
---
